// Minimal stub for @prisma/client used in unit/integration tests
// Provides a dummy PrismaClient class with connect/disconnect no-ops so that
// any code importing it won’t crash during Jest runs.
const _db = {};
function _getTable(model) {
  if (!_db[model]) _db[model] = [];
  return _db[model];
}

class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        if (prop in target) return target[prop];
        // Return a model proxy where any method is an async no-op
        return new Proxy(
          {},
          {
            get(_t, method) {
              return async (...args) => {
                if (method === 'findMany') {
                  const data = _getTable(prop);
                  return data.filter(() => true);
                }
                if (method === 'create') {
                  const record = { ...(args[0]?.data ?? {}) };
                  _getTable(prop).push(record);
                  return record;
                }
                if (method === 'update') {
                  const { where = {}, data = {} } = args[0] || {};
                  const rec = _getTable(prop).find(row =>
                    Object.entries(where).every(([k, v]) => row[k] === v)
                  );
                  if (rec) {
                    Object.entries(data).forEach(([k, v]) => {
                      if (typeof v === 'object' && v !== null) {
                        if ('increment' in v) rec[k] = (rec[k] || 0) + v.increment;
                        else if ('decrement' in v)
                          rec[k] = Math.max((rec[k] || 0) - v.decrement, 0);
                      } else {
                        rec[k] = v;
                      }
                    });
                  }
                  return rec;
                }

                if (method === 'deleteMany') {
                  _db[prop] = [];
                  return {};
                }
                if (method === 'findUnique') {
                  const where = args[0]?.where ?? {};
                  return (
                    _getTable(prop).find(rec => {
                      return Object.entries(where).every(([k, v]) => rec[k] === v);
                    }) ?? null
                  );
                }
                return undefined;
              };
            },
          }
        );
      },
    });
  }
  async $connect() {}
  async $disconnect() {}
}

// Provide Object.prototype.prisma getter/setter so any object can access a shared PrismaClient in tests
if (!global.__definePrismaGetter) {
  Object.defineProperty(Object.prototype, 'prisma', {
    configurable: true,
    enumerable: false,
    get() {
      return global.__sharedPrisma || (global.__sharedPrisma = new PrismaClient());
    },
    set(val) {
      global.__sharedPrisma = val;
    },
  });
  global.__definePrismaGetter = true;
}

module.exports = {
  PrismaClient,
  Prisma: {},
  default: PrismaClient,
};
