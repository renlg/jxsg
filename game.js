import { Game } from './js/game.js'
import { MenuScene } from './js/scenes/menu.js'
import { MapScene } from './js/scenes/map.js'
import { MainCityScene } from './js/scenes/maincity.js'
import { BattleScene } from './js/scenes/battle.js'

const game = new Game()
game.register('menu', MenuScene)
game.register('map', MapScene)
game.register('maincity', MainCityScene)
game.register('battle', BattleScene)
game.start('menu')

// 暴露到全局方便调试
GameGlobal.game = game
