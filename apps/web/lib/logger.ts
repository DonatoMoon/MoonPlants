const isProd = process.env.NODE_ENV === 'production';

type LogArgs = Parameters<typeof console.log>;

export const log = {
  debug: (...args: LogArgs) => {
    if (!isProd) console.debug('[debug]', ...args);
  },
  info: (...args: LogArgs) => {
    if (!isProd) console.info('[info]', ...args);
  },
  warn: (...args: LogArgs) => {
    if (!isProd) console.warn('[warn]', ...args);
  },
  error: (...args: LogArgs) => {
    console.error('[error]', ...args);
  },
};
