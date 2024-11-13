import { datadogRum } from '@datadog/browser-rum';
import { useRef } from 'react';
import { record } from 'rrweb';

const findStartAndEnd = (rrwebEvents) => {
  const start = rrwebEvents[0].timestamp;
  const end = rrwebEvents[rrwebEvents.length - 1].timestamp;
  return {
    start,
    end,
  };
};

const useRrweb = () => {
  const datadogRumContextRef = useRef({
    applicationId: null,
    sessionId: null,
    viewId: null,
  });

  const indexRef = useRef(0);
  const rrwebEventsRef = useRef([]);
  const stopRecordingRef = useRef(null);

  const initDatadogContextInterval = ({ replayIngestUrl, tabId }) => {
    setInterval(() => {
      const context = datadogRum.getInternalContext();
      if (context && context.session_id) {
        const { application_id, session_id, view } = context;

        // we should start a new replay recording
        if (session_id !== datadogRumContextRef.current.sessionId) {
          const stopRecording = stopRecordingRef.current;
          if (stopRecording) {
            try {
              stopRecording();
            } catch (e) {
              // Do something
            }
          }

          const rrwebEvents = [...rrwebEventsRef.current];
          const index = indexRef.current;

          if (rrwebEvents.length) {
            persistEvents({ index, replayIngestUrl, rrwebEvents, tabId });
            rrwebEventsRef.current = [];
          }

          indexRef.current = 0;
          startRecording();
        }

        datadogRumContextRef.current = {
          applicationId: application_id,
          sessionId: session_id,
          viewId: view.id,
        };
      }
    }, 1000);
  };

  const persistEvents = ({ index, replayIngestUrl, rrwebEvents, tabId }) => {
    if (rrwebEvents.length) {
      const { applicationId, sessionId, viewId } = datadogRumContextRef.current;
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

      fetch(replayIngestUrl, {
        method: 'POST',
        body: formData,
      });
    }
  };

  const saveEvents =
    ({ replayIngestUrl, tabId }) =>
    () => {
      const rrwebEvents = [...rrwebEventsRef.current];
      const index = indexRef.current;

      if (rrwebEvents.length) {
        persistEvents({ index, replayIngestUrl, rrwebEvents, tabId });

        rrwebEventsRef.current = [];
        indexRef.current = index + 1;
      }
    };

  const init = ({ replayIngestUrl, tabId }) => {
    initDatadogContextInterval({ replayIngestUrl, tabId });

    setInterval(() => {
      requestAnimationFrame(saveEvents({ replayIngestUrl, tabId }));
    }, 5000);
  };

  const startRecording = () => {
    stopRecordingRef.current = record({
      checkoutEveryNms: 1 * 60 * 1000, // checkout every minute
      emit: (event) => {
        rrwebEventsRef.current = [...rrwebEventsRef.current, event];
      },
      recordCanvas: true,
    });
  };

  const stopRecording = () => {
    return stopRecordingRef.current || (() => {});
  };

  return {
    init,
    stopRecording,
  };
};

export default useRrweb;
