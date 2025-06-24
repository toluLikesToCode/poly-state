import {getLocalStorage} from '../storage/local'
export function isDevMode() {
  const isDevMode: boolean = getLocalStorage('APP_CLIENT_DEV_MODE', true)
  return isDevMode
}
