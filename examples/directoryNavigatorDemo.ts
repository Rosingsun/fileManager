import { DirectoryNavigator } from '../src/DirectoryNavigator'

// Example usage
const nav = new DirectoryNavigator('/Users/me/projects')
console.log('root:', nav.getCurrentPath())
nav.openFolder('subA')
console.log('after open subA:', nav.getCurrentPath())
nav.openFolder('subB')
console.log('after open subB:', nav.getCurrentPath())
nav.goBack()
console.log('after goBack:', nav.getCurrentPath())
console.log('breadcrumb:', nav.getBreadcrumb().join(' / '))
