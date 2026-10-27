import { useState } from 'react';
import { CLOUDS } from '../lib/clouds.js';

// Logo badge for a cloud. Uses the image if one is configured and loads; otherwise a text mark.
export default function CloudMark({ cloud, size }) {
  const c = CLOUDS[cloud];
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={'cloud-mark ' + cloud + (size ? ' ' + size : '') + (loaded ? ' has-img' : '')}
      aria-hidden="true"
    >
      {c.mark}
      {c.logo && !failed && (
        <img src={c.logo} alt="" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
      )}
    </span>
  );
}
