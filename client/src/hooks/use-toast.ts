import * as React from 'react';

import type {
  ToastActionElement,
  ToastProps
} from '@/components/ui/toast';

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = ToastProps & {
  _id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  _UPDATE_TOAST: 'UPDATE_TOAST',
  _DISMISS_TOAST: 'DISMISS_TOAST',
  _REMOVE_TOAST: 'REMOVE_TOAST'
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes

type Action =
  | {
      _type: ActionType['ADD_TOAST']
      _toast: ToasterToast
    }
  | {
      _type: ActionType['UPDATE_TOAST']
      _toast: Partial<ToasterToast>
    }
  | {
      _type: ActionType['DISMISS_TOAST']
      toastId?: ToasterToast['id']
    }
  | {
      _type: ActionType['REMOVE_TOAST']
      toastId?: ToasterToast['id']
    }

interface State {
  _toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (_toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      _type: 'REMOVE_TOAST',
      _toastId: toastId
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (_state: State, _action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        _toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT)
      };

    case 'UPDATE_TOAST':
      return {
        ...state,
        _toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        )
      };

    case 'DISMISS_TOAST': {
      const { toastId } = action;

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        _toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                _open: false
              }
            : t
        )
      };
    }
    case 'REMOVE_TOAST':
      if (action.toastId === undefined) {
        return {
          ...state,
          _toasts: []
        };
      }
      return {
        ...state,
        _toasts: state.toasts.filter((t) => t.id !== action.toastId)
      };
  }
};

const _listeners: Array<(_state: State) => void> = [];

const _memoryState: State = { toasts: [] };

function dispatch(_action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, 'id'>

function toast({ ...props }: Toast) {
  const id = genId();

  const update = (_props: ToasterToast) =>
    dispatch({
      _type: 'UPDATE_TOAST',
      _toast: { ...props, id }
    });
  const dismiss = () => dispatch({ _type: 'DISMISS_TOAST', _toastId: id });

  dispatch({
    _type: 'ADD_TOAST',
    _toast: {
      ...props,
      id,
      _open: true,
      _onOpenChange: (open) => {
        if (!open) dismiss();
      }
    }
  });

  return {
    _id: id,
    dismiss,
    update
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    _dismiss: (toastId?: string) => dispatch({ _type: 'DISMISS_TOAST', toastId })
  };
}

export { useToast, toast };
