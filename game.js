import { Game } from './js/game.js'
import { StartScene } from './js/scenes/start.js'
import { MainScene } from './js/scenes/main.js'
import { HomeScene } from './js/scenes/home.js'

const game = new Game()
game.register('start', StartScene)
game.register('main', MainScene)
game.register('home', HomeScene)
game.start('start')

// 暴露到全局方便调试
GameGlobal.game = game
