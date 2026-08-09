/**
 * Aurora — Background aurora animation.
 *
 * FIX: The original had a golden stripe issue caused by an amber-colored
 * radial gradient that created a visible horizontal band. This version
 * uses teal and violet ONLY, with all blobs fully contained within the
 * viewport via overflow:hidden on the wrapper and negative-safe positioning.
 *
 * The blobs are large soft radial gradients with blur, animated via CSS
 * keyframes for a gentle floating effect.
 */
export function Aurora() {
  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {/* Teal blob - top left */}
      <div
        className="absolute rounded-full"
        style={{
          width: '600px',
          height: '600px',
          top: '-200px',
          left: '-150px',
          background:
            'radial-gradient(circle, rgba(20,184,166,0.15) 0%, rgba(20,184,166,0.05) 40%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'aurora-float 20s ease-in-out infinite',
        }}
      />
      {/* Violet blob - top right */}
      <div
        className="absolute rounded-full"
        style={{
          width: '500px',
          height: '500px',
          top: '-100px',
          right: '-100px',
          background:
            'radial-gradient(circle, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.04) 40%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'aurora-float 25s ease-in-out infinite reverse',
          animationDelay: '-5s',
        }}
      />
      {/* Teal blob - bottom right */}
      <div
        className="absolute rounded-full"
        style={{
          width: '550px',
          height: '550px',
          bottom: '-200px',
          right: '-100px',
          background:
            'radial-gradient(circle, rgba(13,148,136,0.10) 0%, rgba(13,148,136,0.03) 40%, transparent 70%)',
          filter: 'blur(70px)',
          animation: 'aurora-float 22s ease-in-out infinite',
          animationDelay: '-10s',
        }}
      />
      {/* Violet blob - bottom left */}
      <div
        className="absolute rounded-full"
        style={{
          width: '450px',
          height: '450px',
          bottom: '-150px',
          left: '-100px',
          background:
            'radial-gradient(circle, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0.02) 40%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'aurora-float 28s ease-in-out infinite reverse',
          animationDelay: '-15s',
        }}
      />
    </div>
  );
}
