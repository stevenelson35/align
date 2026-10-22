import { Icon } from './Icon'

/** What a task card's left-edge color means (who can see it, a project, or finished). */
export function ColorKey() {
  return (
    <p className="color-key small muted" aria-label="Color key">
      <span className="key color-private">
        Only me <Icon name="lock" />
      </span>
      <span className="key color-family">Family / Everyone</span>
      <span className="key color-shared">
        Parents <Icon name="parents" /> · Chosen people <Icon name="shared" />
      </span>
      <span className="key color-project">Project</span>
      <span className="key color-done">Finished</span>
    </p>
  )
}
