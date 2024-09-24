import { datadogRum } from '@datadog/browser-rum';
import useRrweb from './useRrweb';

const initDDBrowserSdk = ({ config, user }) => {
  const {
    applicationId,
    clientToken,
    env,
    proxy,
    site,
  } = config;

  const ddConfig = {
    applicationId,
    clientToken,
    defaultPrivacyLevel: 'mask-user-input',
    env,
    site,
    service: 'kf-frontend',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
  };

  if (proxy) {
    ddConfig.proxy = proxy;
  }

  datadogRum.init(ddConfig);

  const { id, email } = user;

  datadogRum.setUser({
    id,
    email,
  });

  datadogRum.startSessionReplayRecording();
};


const useBrowserSdk = ({ config, user }) => {
  const rrweb = useRrweb({ replayIngestUrl: config.replayIngestUrl });

  const init = () => {
    initDDBrowserSdk({ config, user });
    rrweb.init();
  };

  return {
    init,
  };
};

export default useBrowserSdk;
