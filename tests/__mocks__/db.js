// Simple in-memory Drizzle-like DB mock used via @db alias in Jest tests
// Provides models with Prisma-like CRUD methods (create, findMany, findUnique, deleteMany, update)

// Internal state storage
const _objectStore = new Map(); // _key: table object reference -> rows array
const _legacyStore = {}; // _key: string model name -> rows array
// Map from inferred table name (string) to table object reference so that
// we can resolve `db.query.<table>` calls
const _tableByName = new Map();
// Resolve array of rows for a table object or string key
function getRows(tableObj) {
  if (!_objectStore.has(tableObj)) {
    _objectStore.set(tableObj, []);
  }
  return _objectStore.get(tableObj);
}

function inferName(tableObj) {
  if (typeof tableObj === 'string') return tableObj;
  // Drizzle table objects expose ._ in compiled js; fall back to .tableName or name
  return tableObj?.tableName || tableObj?.name || tableObj?.[Symbol.for('name')] || 'unknown';
}

function registerTable(tableObj) {
  // inject a dummy eq comparator on column properties to satisfy tests
  Object.keys(tableObj || {}).forEach(colName => {
    const col = tableObj[colName];
    if (col && typeof col === 'object' && !col.eq) {
      col.eq = val => row => row[colName] === val; // simply returns truthy predicate ignored by where()
    }
  });
  const name = inferName(tableObj);
  if (name && !_tableByName.has(name)) {
    _tableByName.set(name, tableObj);
  }
}

function raw(expr){
  return { __raw: expr };
}

function table(name) {
  if (!_legacyStore[name]) _legacyStore[name] = [];
  return _legacyStore[name]; // legacy per-model store
}

function makeModelProxy(modelName) {
  return {
    async create({ data }) {
      const rows = table(modelName);
      const recId = data.id ?? rows.length + 1;
      const rec = { ...data, _id: recId };
      rows.push(rec);
      return rec;
    },
    async findMany({ where = {} } = {}) {
      return table(modelName).filter(row => Object.entries(where).every(([k, v]) => row[k] === v));
    },
    async findUnique({ where = {} } = {}) {
      return (
        table(modelName).find(row => Object.entries(where).every(([k, v]) => row[k] === v)) || null
      );
    },
    async deleteMany() {
      _legacyStore[modelName] = [];
      return {};
    },
    async update({ where = {}, data = {} }) {
      const rows = await this.findMany({ where });
      rows.forEach(row => {
        Object.entries(data).forEach(([k,v])=>{
          if(v && v.__raw){ _applyRawExpression(row,k,v.__raw); }
          else { row[k]=v; }
        });
      });
      return rows[0] ?? null;
    },
  };
}

// Utility to apply data/update object or function
function applyData(row, data) {
  const newData = typeof data === 'function' ? data(row) : data;
  const processed = { ...newData };
  // Handle increment/decrement object { _increment: n } or { _decrement: n }
  if (
    processed &&
    typeof processed.loyaltyPoints === 'object' &&
    processed.loyaltyPoints !== null
  ) {
    const { increment, decrement } = processed.loyaltyPoints;
    if (typeof increment === 'number') {
      processed.loyaltyPoints = (row.loyaltyPoints || 0) + increment;
    } else if (typeof decrement === 'number') {
      processed.loyaltyPoints = Math.max((row.loyaltyPoints || 0) - decrement, 0);
    }
  }

  if (typeof processed.loyaltyPoints === 'string') {
    const addMatch = processed.loyaltyPoints.match(/\+\s*(\d+)/);
    const subMatch = processed.loyaltyPoints.match(/-\s*(\d+)/);
    if (addMatch) {
      const delta = parseInt(addMatch[1], 10);
      processed.loyaltyPoints = (row.loyaltyPoints || 0) + delta;
    } else if (subMatch) {
      const delta = parseInt(subMatch[1], 10);
      processed.loyaltyPoints = Math.max((row.loyaltyPoints || 0) - delta, 0);
    }
  }
  // Handle Drizzle raw expressions
  Object.entries(processed).forEach(([k,v])=>{
    if(v && v.__raw){ _applyRawExpression(row,k,v.__raw); }
    else { row[k] = v; }
  });
}

// ---- Drizzle-lite builder helpers ----
function insertBuilder(tableObj) {
  registerTable(tableObj);
  return {
    values(data) {
      const rec = { ...data, _id: data.id ?? getRows(tableObj).length + 1 };
      getRows(tableObj).push(rec);
      return {
        returning() {
          return [rec];
        },
      };
    },
  };
}

function updateBuilder(tableObj) {
  registerTable(tableObj);
  return {
    set(data) {
      return {
        where(_predicate) {
          const rows = getRows(tableObj);
          let target = rows;
          if (typeof _predicate === 'function') {
            target = rows.filter(_predicate);
          }
          target.forEach(row => applyData(row, data));
          return {
            returning() {
              return rows;
            },
          };
        },
      };
    },
  };
}

function selectBuilder() {
  return {
    from(tableObj) {
      registerTable(tableObj);
      const rows = getRows(tableObj);
      return {
        where(_predicate) {
          let results = rows;
          if (typeof _predicate === 'function') {
            results = rows.filter(_predicate);
          }
          return {
            limit(n){
              return results.slice(0, n);
            },
            _all: () => results,
            *[Symbol.iterator]() { for(const r of results) yield r; }
          };
        },
        limit(n) {
          return rows.slice(0, n);
        },
      };
    },
  };
}

function deleteRows(tableObj) {
  registerTable(tableObj);
  _objectStore.set(tableObj, []);
  return { _where: () => ({}) };
}

const queryProxy = new Proxy(
  {},
  {
    get(_t, prop) {
      const tableObj = _tableByName.get(prop) || prop;
      return {
        _findMany: ({ where = {} } = {}) => makeModelProxy(prop).findMany({ where }),
        _findFirst: async () => (await makeModelProxy(prop).findMany())[0] ?? null,
      };
    },
  }
);

// --- Legacy Prisma-like per-model proxy section (used by some unit tests) ---
const models = [
  'customer',
  'loyaltyMember',
  'loyaltyTransaction',
  'transaction',
  'store',
  'inventoryItem',
  'refund',
];

// Base object exposing Drizzle-like helpers
const baseDb = {
  _insert: insertBuilder,
  _update: updateBuilder,
  _select: selectBuilder,
  _delete: deleteRows,
  raw,
  _raw: sql => sql,
  _query: queryProxy,
  table,
  insert,
  update,
  raw,
};

const db = new Proxy(baseDb, {
  get(target, prop, receiver) {
    // Prefer existing keys (insert/update/etc.)
    if (Reflect.has(target, prop)) {
      return Reflect.get(target, prop, receiver);
    }
    // Fallback to dynamic model proxies
    if (typeof prop === 'string') {
      if (!models.includes(prop)) models.push(prop);
      return makeModelProxy(prop);
    }
    return undefined;
  },
});

function raw(sql) {
  return sql; // passthrough helper for tests
}

function _applyRawExpression(row, key, expr){
  // Very naive SQL-like parser for patterns like '"loyalty_points" + 9' or '"loyalty_points" - 4'
  const addMatch = expr.match(/\+\s*(\d+)/);
  const subMatch = expr.match(/-\s*(\d+)/);
  if(addMatch){
    const inc = parseInt(addMatch[1],10);
    row[key] = (row[key] || 0) + inc;
    return;
  }
  if(subMatch){
    const dec = parseInt(subMatch[1],10);
    row[key] = Math.max((row[key] || 0) - dec, 0);
    return;
  }
  const greatestMatch = expr.match(/GREATEST\("loyalty_points" - (\d+), 0\)/);
  if(greatestMatch){
    const dec = parseInt(greatestMatch[1],10);
    row[key] = Math.max((row[key]||0)-dec,0);
    return;
  }
}

// Insert builder
function insert(tableObj){
  return {
    values(vals){
      const rows = getRows(tableObj);
      const recId = vals.id ?? rows.length+1;
      const rec = { ...vals, _id: recId };
      rows.push(rec);
      return {
        returning(){ return [rec]; }
      };
    }
  };
}

function update(tableObj){
  return {
    set(data){
      return {
        where(predicate){
          const rows = getRows(tableObj).filter(row=>predicate(row));
          rows.forEach(row=>{
            Object.entries(data).forEach(([k,v])=>{
              if(v && v.__raw){ _applyRawExpression(row,k,v.__raw); }
              else { row[k]=v; }
            });
          });
          return {
            returning(){ return rows; }
          };
        }
      };
    }
  };
}

function del(tableObj){
  return {
    where(predicate){
      const rows = getRows(tableObj);
      const remaining = rows.filter(row=>!predicate(row));
      _objectStore.set(tableObj, remaining);
      return { returning(){ return []; } };
    }
  };
}

module.exports = { db, _default: db };
