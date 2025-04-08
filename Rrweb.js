import { datadogRum } from '@datadog/browser-rum';
import { record } from 'rrweb';

const findStartAndEnd = (rrwebEvents) => {
  const start = rrwebEvents[0].timestamp;
  const end = rrwebEvents[rrwebEvents.length - 1].timestamp;
  return {
    start,
    end,
  };
};

const getMaskSettings = (defaultPrivacyLevel) => {
  if (defaultPrivacyLevel === 'mask-user-input') {
    return {
      maskAllInputs: true,
    };
  }

  if (defaultPrivacyLevel === 'mask') {
    try {
      document.body.classList.add("rr-mask");
    } catch (e) {
    }
    return {
      maskAllInputs: true,
      maskTextClass:  /[\s\S]*/,
      maskTextFn: (t) => {
        return t.replace(/[a-z]/g, '*');
      },
    };
  }

  if (defaultPrivacyLevel === 'allow') {
    return {};
  }

  return {
    maskAllInputs: true,
  };
};

class Rrweb {
  constructor() {
    this.clientToken = null;
    this.datadogRumContextRef = {
      current: {
        applicationId: null,
        sessionId: null,
        viewId: null,
      },
    };

    this.indexRef = {
      current: 0,
    };

    this.rrwebEventsRef = {
      current: [],
    };

    this.stopRecordingRef = {
      current: null,
    };
  }

  initDatadogContextInterval({ defaultPrivacyLevel, replayIngestUrl, tabId }) {
    setInterval(() => {
      const context = datadogRum.getInternalContext();
      if (context && context.session_id) {
        const { application_id, session_id, view } = context;

        // we should start a new replay recording
        if (session_id !== this.datadogRumContextRef.current.sessionId) {
          const stopRecording = this.stopRecordingRef.current;
          if (stopRecording) {
            try {
              this.stopRecording();
            } catch (e) {
              // Do something
            }
          }

          const rrwebEvents = [...this.rrwebEventsRef.current];
          const index = this.indexRef.current;

          if (rrwebEvents.length) {
            this.persistEvents({ index, replayIngestUrl, rrwebEvents, tabId });
            this.rrwebEventsRef.current = [];
          }

          this.indexRef.current = 0;
          this.startRecording({ defaultPrivacyLevel });
        }

        this.datadogRumContextRef.current = {
          applicationId: application_id,
          sessionId: session_id,
          viewId: view.id,
        };
      }
    }, 1000);
  }

  persistEvents({ index, replayIngestUrl, rrwebEvents, tabId }) {
    if (rrwebEvents.length) {
      const { applicationId, sessionId, viewId } =
        this.datadogRumContextRef.current;
      const { start, end } = findStartAndEnd(rrwebEvents);
      const event = {
        application: {
          id: applicationId,
        },
        session: {
          id: sessionId,
        },
        index,

        end,
        start,
        tab: {
          id: tabId,
        },
        view: {
          id: viewId,
        },
      };

      const segment = {
        rrwebEvents,
      };

      const formData = new FormData();
      formData.append('event', JSON.stringify(event));
      formData.append('segment', JSON.stringify(segment));

      fetch(`${replayIngestUrl}${this.clientToken ? `?kf-api-key=${this.clientToken}`: ''}`, {
        method: 'POST',
        body: formData,
      });
    }
  }

  saveEvents({ replayIngestUrl, tabId }) {
    return () => {
      const rrwebEvents = [...this.rrwebEventsRef.current];
      const index = this.indexRef.current;

      if (rrwebEvents.length) {
        this.persistEvents({ index, replayIngestUrl, rrwebEvents, tabId });

        this.rrwebEventsRef.current = [];
        this.indexRef.current = index + 1;
      }
    };
  }

  init({ clientToken, defaultPrivacyLevel, replayIngestUrl, tabId }) {
    this.clientToken = clientToken;
    this.initDatadogContextInterval({ defaultPrivacyLevel, replayIngestUrl, tabId });

    setInterval(() => {
      requestAnimationFrame(this.saveEvents({ replayIngestUrl, tabId }));
    }, 5000);
  }

  startRecording({ defaultPrivacyLevel }) {
    this.stopRecordingRef.current = record({
      ...getMaskSettings(defaultPrivacyLevel),
      checkoutEveryNms: 1 * 60 * 1000, // checkout every minute
      emit: (event) => {
        this.rrwebEventsRef.current = [...this.rrwebEventsRef.current, event];
      },
      recordCanvas: true,
    });
  }

  stopRecording() {
    return this.stopRecordingRef.current || (() => {});
  }
}

export default Rrweb;
