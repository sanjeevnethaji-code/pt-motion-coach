import { useState } from 'react'
import { COACHING } from './coaching'

const EXERCISE_VIDEOS = {
  'heel-slides': [{ title: 'Heel slides', provider: 'UCSF Sports Medicine', embed: 'https://www.youtube-nocookie.com/embed/ZIcEXtZq_H4', source: 'https://sportsrehab.ucsf.edu/content/knee' }],
  'heel-props': [{ title: 'Heel prop', provider: 'Lincoln Surgical Hospital', video: 'https://lincolnsurgery.com/wp-content/uploads/2026/07/Total-Knee-6.-Heel-Prop.mov', source: 'https://lincolnsurgery.com/patient-information/rehabilitation/' }],
  'ankle-pumps': [{ title: 'Ankle pumps', provider: 'UCSF Sports Medicine', embed: 'https://www.youtube-nocookie.com/embed/SqSUFmI6B5c', source: 'https://sportsrehab.ucsf.edu/content/foot-ankle-mobile' }],
  pendulum: [{ title: 'Pendulum', provider: 'Penn State Health', embed: 'https://player.vimeo.com/video/411407011?dnt=1', source: 'https://www.boneandjoint.psu.edu/course/rotator_cuff/rc_recovery/rc_post_exercises.html' }],
  'elbow-wrist': [
    { title: 'Elbow movement', provider: 'Penn State Health', embed: 'https://player.vimeo.com/video/411406827?dnt=1', source: 'https://www.boneandjoint.psu.edu/course/rotator_cuff/rc_recovery/rc_post_exercises.html' },
    { title: 'Wrist movement', provider: 'Penn State Health', embed: 'https://player.vimeo.com/video/411406428?dnt=1', source: 'https://www.boneandjoint.psu.edu/course/rotator_cuff/rc_recovery/rc_post_exercises.html' },
  ],
  'external-rotation': [{ title: 'Assisted external rotation', provider: 'Penn State Health', embed: 'https://player.vimeo.com/video/411405960?dnt=1', source: 'https://www.boneandjoint.psu.edu/course/rotator_cuff/rc_recovery/rc_post_exercises.html' }],
}

export default function ExercisePreview({ exercise }) {
  const [videoIndex, setVideoIndex] = useState(0)
  const [failed, setFailed] = useState(false)
  const config = COACHING[exercise.id]
  const videos = EXERCISE_VIDEOS[exercise.id]
  const chosen = videos[videoIndex]
  const steps = exercise.id === 'elbow-wrist' && videoIndex === 1 ? config.wristSteps : config.cameraSteps
  return <div className="exercise-preview-grid">
    <section className="demo-video-section" aria-label="Exercise demonstration">
      <h3>1. Watch how it’s done</h3>
      {videos.length > 1 && <div className="controls preview-tabs">{videos.map((item, index) => <button key={item.title} className={index === videoIndex ? 'primary' : 'secondary'} aria-pressed={index === videoIndex} onClick={() => { setVideoIndex(index); setFailed(false) }}>{item.title}</button>)}</div>}
      <div className="demo-video-frame">
        {chosen.video ? <video key={chosen.video} className="exercise-demo-video" controls playsInline preload="metadata" onError={() => setFailed(true)} aria-label={`${chosen.title} demonstration by ${chosen.provider}`}>
          <source src={chosen.video} />Your browser cannot play this video. Use the source link below.
        </video> : <iframe key={chosen.embed} src={chosen.embed} title={`${chosen.title} demonstration by ${chosen.provider}`} allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
      </div>
      <p className="video-credit">Demonstration: {chosen.provider}. <a href={chosen.source} target="_blank" rel="noreferrer">Open original source ↗</a></p>
      <p className="privacy">{failed ? 'This video format could not play here. Open the original source above.' : 'Video needs internet. If the player is blocked or does not load, open the original source above.'}</p>
    </section>
    <section className="preview-directions" aria-label="Exercise instructions before starting">
      <h3>2. Get into position</h3>
      <p className="preview-camera-setup">{config.setup}</p>
      <ol className="preview-steps">{steps.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol>
      <p className="session-note">Demonstrations show general technique. Follow your own surgical restrictions, assistance, and prescribed range; do not copy a video’s repetitions or timing automatically.</p>
    </section>
  </div>
}
