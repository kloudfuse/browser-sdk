import { datadogLogs } from "@datadog/browser-logs";
import { datadogRum } from "@datadog/browser-rum";
import Cookies from "js-cookie";
import { v4 } from "uuid";
import Rrweb from "./Rrweb";

const SESSION_STORE_KEY = "_dd_s";
const SESSION_ENTRY_REGEXP = /^([a-zA-Z]+)=([a-z0-9-]+)$/;
const SESSION_ENTRY_SEPARATOR = "&";

const COMMA_SEPARATED_KEY_VALUE = /([\w-]+)\s*=\s*([^;]+)/g;

let KF_VIEW_TRACKER = {};
let KF_SESSION_START = null;

function findCommaSeparatedValue(rawString, name) {
  COMMA_SEPARATED_KEY_VALUE.lastIndex = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const match = COMMA_SEPARATED_KEY_VALUE.exec(rawString)
    if (match) {
      if (match[1] === name) {
        return match[2]
      }
    } else {
      break
    }
  }
}

function isValidSessionString(sessionString) {
  return (
    !!sessionString &&
    (sessionString.indexOf(SESSION_ENTRY_SEPARATOR) !== -1 || SESSION_ENTRY_REGEXP.test(sessionString))
  )
}

function toSessionState(sessionString) {
  const session = {}
  if (isValidSessionString(sessionString)) {
    sessionString.split(SESSION_ENTRY_SEPARATOR).forEach((entry) => {
      const matches = SESSION_ENTRY_REGEXP.exec(entry)
      if (matches !== null) {
        const [, key, value] = matches
        if (key === 'aid') {
          // we use `aid` as a key for anonymousId
          session.anonymousId = value
        } else {
          session[key] = value
        }
      }
    })
  }
  return session
}


const findSessionStart = () => {
  let cookieValue = findCommaSeparatedValue(document.cookie, '_dd_s')
  let sessionState = toSessionState(cookieValue)
  return Number(sessionState.created)
}

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
    defaultPrivacyLevel: config.defaultPrivacyLevel || "mask-user-input",
    enablePrivacyForActionName: config.enablePrivacyForActionName || false,
    env: config.env,
    proxy: config.proxy,
    service: config.service,
    sessionSampleRate: config.sessionSampleRate,
    site: config.site || "",
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

      if (KF_SESSION_START == null) {
        KF_SESSION_START = findSessionStart()
      }

      let viewId = null;
      if (event.type == "view") {
        viewId = event.id;
        KF_VIEW_TRACKER[viewId] = event.date;
      } else {
        viewId = event.view.id;
      }
      event.context.kf_session_start_ms = KF_SESSION_START;
      event.context.kf_view_start_ms = KF_VIEW_TRACKER[event.id];

      if (typeof config.beforeSend === "function") {
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
      if (proxy.indexOf("/") === 0) {
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

    initDDBrowserSdk({
      config: ddConfig,
      hasReplayBeenInitedRef: this.hasReplayBeenInitedRef,
      tabId,
    });

    const shouldInitRrweb = getShouldInitRrweb();

    if (enableSessionRecording && shouldInitRrweb && replayIngestUrl) {
      this.rrweb.init({
        clientToken: ddConfig.clientToken,
        defaultPrivacyLevel: ddConfig.defaultPrivacyLevel,
        replayIngestUrl,
        tabId,
      });
      this.hasReplayBeenInitedRef.current = true;
    }

    if (enableLogCollection) {
      datadogLogs.init({
        clientToken: ddConfig.clientToken,
        proxy: ddConfig.proxy,
        site: ddConfig.site,
        forwardErrorsToLogs: true,
        forwardConsoleLogs: "all",
        sessionSampleRate: 100,
      });
    }
  }

  addAction(property, context = {}) {
    try {
      datadogRum.addAction(property, context);
    } catch (e) {
      console.error('Failed to addAction', e);
    }
  }

  addError(error, context = {}) {
    try {
      datadogRum.addError(error, context);
    } catch (e) {
      console.error('Failed to addError', e);
    }
  }

  addTiming(...args) {
    try {
      datadogRum.addTiming(...args);
    } catch (e) {
      console.error('Failed to addTiming', e);
    }
  }

  addDurationVital(...args) {
    try {
      datadogRum.addDurationVital(...args);
    } catch (e) {
      console.error('Failed to addDurationVital', e);
    }
  }

  startDurationVital(...args) {
    try {
      datadogRum.startDurationVital(...args);
    } catch (e) {
      console.error('Failed to startDurationVital', e);
    }
  }

  stopDurationVital(...args) {
    try {
      datadogRum.stopDurationVital(...args);
    } catch (e) {
      console.error('Failed to stopDurationVital', e);
    }
  }

  setUser(user) {
    try {
      const { id, email } = user;

      datadogRum.setUser({
        id,
        email,
      });
    } catch (e) {
      console.error('Failed to setUser', e);
    }
  }

  startView(args) {
    datadogRum.startView(args);
  }
}

const browserSdk = new BrowserSdk();

export default browserSdk;
