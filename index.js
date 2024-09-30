import { datadogRum } from '@datadog/browser-rum';
import useRrweb from './useRrweb';
import { v4 } from 'uuid';

const initDDBrowserSdk = ({ config, shouldInitRrweb, tabId, user }) => {
  const ddConfig = {
    ...config,
    defaultPrivacyLevel: 'mask-user-input',
    service: 'kf-frontend',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 0,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    beforeSend: (event) => {
      if (event.type === 'view' && shouldInitRrweb) {
        event.context.has_replay = true;
        event.context.tabId = tabId;
      }

      return true;
    },
  };

  datadogRum.init(ddConfig);

  const { id, email } = user;

  datadogRum.setUser({
    id,
    email,
  });

  datadogRum.startSessionReplayRecording();
};


const useBrowserSdk = () => {
  const rrweb = useRrweb();

  const init = ({ config, user }) => {
    const tabId = v4();
    const { replayIngestUrl, ...ddConfig } = config;
    const shouldInitRrweb =  replayIngestUrl;

    initDDBrowserSdk({ config: ddConfig, shouldInitRrweb, tabId, user });

    if (shouldInitRrweb) {
      rrweb.init({ replayIngestUrl, tabId });
    }
  };

  return {
    init,
  };
};

export default useBrowserSdk;
