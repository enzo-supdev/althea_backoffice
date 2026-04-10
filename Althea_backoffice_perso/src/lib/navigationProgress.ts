const NAVIGATION_PROGRESS_START_EVENT = 'althea:navigation-progress:start'
const NAVIGATION_PROGRESS_DONE_EVENT = 'althea:navigation-progress:done'

function dispatchNavigationProgressEvent(eventName: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(eventName))
}

export function startNavigationProgress() {
  dispatchNavigationProgressEvent(NAVIGATION_PROGRESS_START_EVENT)
}

export function doneNavigationProgress() {
  dispatchNavigationProgressEvent(NAVIGATION_PROGRESS_DONE_EVENT)
}

export {
  NAVIGATION_PROGRESS_START_EVENT,
  NAVIGATION_PROGRESS_DONE_EVENT,
}
