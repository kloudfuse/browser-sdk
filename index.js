import { datadogRum } from '@datadog/browser-rum';
import useRrweb from './useRrweb';

const initDDBrowserSdk = ({ config, shouldInitRrweb, user }) => {
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
        event.session.has_replay = true;
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
    const { replayIngestUrl, ...ddConfig } = config;
    const shouldInitRrweb =  replayIngestUrl;

    initDDBrowserSdk({ config: ddConfig, shouldInitRrweb, user });

    if (shouldInitRrweb) {
      rrweb.init({ replayIngestUrl });
    }
  };

  return {
    init,
  };
};

export default useBrowserSdk;
