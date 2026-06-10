/**
 * Cinematic letterbox: two black bars cover the frame and OPEN as the
 * hero loads (pure CSS animation, see .letterbox in styles.css), then
 * settle as slim persistent cinema bars.
 */
export default function Letterbox() {
  return (
    <>
      <div className="letterbox letterbox--top" aria-hidden="true" />
      <div className="letterbox letterbox--bottom" aria-hidden="true" />
    </>
  )
}
