import { datadogLogs } from '@datadog/browser-logs';
import { datadogRum } from '@datadog/browser-rum';
import Cookies from 'js-cookie';
import { useRef } from 'react';
import { v4 } from 'uuid';
import useRrweb from './useRrweb';

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
    env: config.env,
    proxy: config.proxy,
    service: config.service,
    sessionSampleRate: config.sessionSampleRate,
    site: config.site,
    sessionReplaySampleRate: 0,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    version: config.version,
    beforeSend: (event) => {
      event.context.rrweb_tab_id = tabId;

      if (hasReplayBeenInitedRef.current) {
        event.context.rrweb_has_replay = true;
      }

      return true;
    },
  };

  datadogRum.init(ddConfig);
};

const getShouldInitRrweb = () => {
  const sessionString = Cookies.get(SESSION_STORE_KEY);
  const sessionState = toSessionState(sessionString);
  return typeof sessionState.rum && Number(sessionState.rum) > 0;
};

const useBrowserSdk = () => {
  const hasReplayBeenInitedRef = useRef();
  const rrweb = useRrweb();

  const init = ({ config }) => {
    const tabId = v4();
    const {
      enableLogCollection,
      enableSessionRecording,
      replayIngestUrl,
      ...ddConfig
    } = config;

    initDDBrowserSdk({ config: ddConfig, hasReplayBeenInitedRef, tabId });

    const shouldInitRrweb = getShouldInitRrweb();

    console.log(enableSessionRecording, shouldInitRrweb, replayIngestUrl);

    if (enableSessionRecording && shouldInitRrweb && replayIngestUrl) {
      rrweb.init({ replayIngestUrl, tabId });
      hasReplayBeenInitedRef.current = true;
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
  };

  const setUser = (user) => {
    const { id, email } = user;

    datadogRum.setUser({
      id,
      email,
    });
  };

  return {
    init,
    setUser,
  };
};

export default useBrowserSdk;
