const state = () => globalThis.__pageCanMediaBrowserTestState;

export const browser = {
  runtime: {
    onMessage: {
      addListener(listener) {
        state().messageListener = listener;
      },
      removeListener(listener) {
        if (state().messageListener === listener) state().messageListener = null;
      },
    },
    onConnect: {
      addListener(listener) {
        state().connectListener = listener;
      },
      removeListener(listener) {
        if (state().connectListener === listener) state().connectListener = null;
      },
    },
    async sendMessage(message) {
      state().sentMessages.push(structuredClone(message));
    },
  },
};
