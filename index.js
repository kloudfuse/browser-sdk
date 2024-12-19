import { datadogLogs } from '@datadog/browser-logs';
import { datadogRum } from '@datadog/browser-rum';
import Cookies from 'js-cookie';
import { v4 } from 'uuid';
import Rrweb from './Rrweb';

const SESSION_STORE_KEY = '_dd_s';
const SESSION_ENTRY_REGEXP = /^([a-zA-Z]+)=([a-z0-9-]+)$/;
const SESSION_ENTRY_SEPARATOR = '&';

const toSessionState = (sessionString) => {
  const session = {};
  if (isValidSessionString(sessionString)) {
    sessionString.split(SESSION_ENTRY_SEPARATOR).forEach((entry) => {
      const matches = SESSION_ENTRY_REGEXP.exec(entry);
      if (matches !== null) {
        const [, key, value] = matches;
        session[key] = value;
      }
    });
  }
  return session;
};

const isValidSessionString = (sessionString) => {
  return (
    !!sessionString &&
    (sessionString.indexOf(SESSION_ENTRY_SEPARATOR) !== -1 ||
      SESSION_ENTRY_REGEXP.test(sessionString))
  );
};

const initDDBrowserSdk = ({ config, hasReplayBeenInitedRef, tabId }) => {
  const ddConfig = {
    applicationId: config.applicationId,
    clientToken: config.clientToken,
    defaultPrivacyLevel: 'mask-user-input',
    enablePrivacyForActionName: config.enablePrivacyForActionName || false,
    env: config.env,
    proxy: config.proxy,
    service: config.service,
    sessionSampleRate: config.sessionSampleRate,
    site: config.site || '',
    sessionReplaySampleRate: 0,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    trackViewsManually: config.trackViewsManually || false,
    version: config.version,
    beforeSend: (event) => {
      event.context.rrweb_tab_id = tabId;

      if (hasReplayBeenInitedRef.current) {
        event.context.rrweb_has_replay = true;
      }

      if (typeof config.beforeSend === 'function') {
        return config.beforeSend(event);
      }

      return true;
    },
  };

  datadogRum.init(ddConfig);
};

const getShouldInitRrweb = () => {
  const sessionString = Cookies.get(SESSION_STORE_KEY);
  const sessionState = toSessionState(sessionString);
  return Number(sessionState.rum) > 0;
};

const getReplayIngestUrl = (proxy) => {
  try {
    if (proxy) {
      if (proxy.indexOf('/') === 0) {
        return `/rumrrweb`;
      }

      const url = new URL(proxy);
      return `${url.origin}/rumrrweb`;
    }

    return null;
  } catch (e) {
    return null;
  }
};

class BrowserSdk {
  constructor() {
    this.hasReplayBeenInitedRef = { current: false };
    this.rrweb = new Rrweb();
  }

  init({ config }) {
    const tabId = v4();
    const { enableLogCollection, enableSessionRecording, ...ddConfig } = config;

    const replayIngestUrl = getReplayIngestUrl(config.proxy);

    initDDBrowserSdk({ config: ddConfig, hasReplayBeenInitedRef: this.hasReplayBeenInitedRef, tabId });

    const shouldInitRrweb = getShouldInitRrweb();

    if (enableSessionRecording && shouldInitRrweb && replayIngestUrl) {
      this.rrweb.init({ replayIngestUrl, tabId });
      this.hasReplayBeenInitedRef.current = true;
    }

    if (enableLogCollection) {
      datadogLogs.init({
        clientToken: ddConfig.clientToken,
        proxy: ddConfig.proxy,
        site: ddConfig.site,
        forwardErrorsToLogs: true,
        forwardConsoleLogs: 'all',
        sessionSampleRate: 100,
      });
    }
  }

  setUser(user) {
    const { id, email } = user;

    datadogRum.setUser({
      id,
      email,
    });
  }

  startView(args) {
    datadogRum.startView(args);
  }
}

const browserSdk = new BrowserSdk();

export default browserSdk;
