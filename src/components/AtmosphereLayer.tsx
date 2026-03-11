import { useRef } from 'react';
import { useAtmosphere } from '@/hooks/useAtmosphere';

export function AtmosphereLayer() {
  const ref = useRef<HTMLDivElement>(null);
  useAtmosphere(ref);

  return (
    <div ref={ref} className="atmosphere-layer">
      {/* Warm light ("the sun") — arcs across the top */}
      <div className="atm-warm" />
      {/* Cool depth ("the shadow") — anchors the bottom */}
      <div className="atm-cool" />
      {/* Focus bloom — center radial, grows with momentum */}
      <div className="atm-bloom" />
      {/* Vertical veil — anchoring darkness */}
      <div className="atm-veil" />
    </div>
  );
}
