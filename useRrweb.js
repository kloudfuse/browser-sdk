import { datadogRum } from '@datadog/browser-rum';
import { useRef } from 'react';
import { record } from 'rrweb';
import { v4 } from 'uuid';

const findStartAndEnd = (rrwebEvents) => {
  const start = rrwebEvents[0].timestamp;
  const end = rrwebEvents[rrwebEvents.length - 1].timestamp;
  return {
    start,
    end,
  };
};

const useRrweb = () => {
  const indexRef = useRef(0);
  const rrwebEventsRef = useRef([]);
  const stopRecordingRef = useRef(null);
  const tabIdRef = useRef(v4());

  const saveEvents = (replayIngestUrl) => () => {
    const rrwebEvents = [...rrwebEventsRef.current];
    const index = indexRef.current;

    if (rrwebEvents.length) {
      const { application_id, session_id, view } =
        datadogRum.getInternalContext();
      const { start, end } = findStartAndEnd(rrwebEvents);
      const event = {
        application: {
          id: application_id,
        },
        session: {
          id: session_id,
        },
        index,

        end,
        start,
        tab: {
          id: tabIdRef.current,
        },
        view: {
          id: view.id,
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

      rrwebEventsRef.current = [];
      indexRef.current = index + 1;
    }
  };

  const init = ({ replayIngestUrl }) => {
    stopRecordingRef.current = record({
      emit: (event) => {
        rrwebEventsRef.current = [...rrwebEventsRef.current, event];
      },
      recordCanvas: true,
    });

    setInterval(() => {
      requestAnimationFrame(saveEvents(replayIngestUrl));
    }, 5000);
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
