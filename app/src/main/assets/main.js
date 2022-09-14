class MessageBus {
  constructor() {
    this.subscribers = {};
  }
  send (type, data) {
    if (this.subscribers[type] !== null && this.subscribers[type] !== undefined) {
      for (var i = 0; i < this.subscribers[type].length; ++i) {
        this.subscribers[type][i]['object'][this.subscribers[type][i]['func']](data);
      }
    }
  }
  subscribe (type, object, func) {
    if (this.subscribers[type] === null || this.subscribers[type] === undefined) {
      this.subscribers[type] = [];
    }
    this.subscribers[type].push({
      object: object,
      func: func
    });
  }
  unsubscribe (type, object, func) {
    for (var i = 0; i < this.subscribers[type].length; ++i) {
      if (this.subscribers[type][i].object === object && this.subscribers[type][i].func === func) {
        this.subscribers[type].slice(i, 1);
        break;
      }
    }
  }
  unsubsribeType (type) {
    delete this.subscribers[type];
  }
  destroy() {
    for (type in this.subscribers) {
      this.unsubsribeType(type);
    }
    this.subscribers = null;
  }
}
class AbstractList {
  constructor (list) {
    this.list = this.getList() || {}
    if (list) this.list = {...list, ...this.list}
  }
  getList() {
    if (this.list === null || this.list === undefined) {
      this.list = JSON.parse(window.localStorage.getItem(this.constructor.name))
    }
    return this.list
  }
  length() {
    return Object.keys(this.list).length
  }
  getDefault() {
    return Object.keys(this.list)[0]
  }
  getItem (id) {
    if (this.list === null || this.list === undefined) {
      this.getList()
    }
    return this.list[id]
  }
  updateItem (id, item) {
    this.list[id] = item
    this.store()
  }
  updateId (id, newid) {
    this.list[newid] = this.list[id]
    this.deleteItem(id)
  }
  deleteItem (id) {
    delete this.list[id]
    this.store()
  }
  store() {
    window.localStorage.setItem(this.constructor.name, JSON.stringify(this.list))
  }
}
class Deck {
  constructor(numCards) {
    this.suits = ['hearts', 'spades', 'diamonds', 'clubs'] 
    this.values = ['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king', 'ace']
    const numValues = (numCards || 36) / this.suits.length
    this.deck = []
    for (let i = 0; i < this.suits.length; ++i) {
      for (let j = 0; j < numValues; ++j) {
        this.deck.push({
          suit: this.suits[i],
          value: this.values[this.values.length - 1 - j],
          valueD: this.values.length - 1 - j
        })
      }
    }
    this.deck.sort(() => Math.random() > 0.5 ? 1 : -1)
  }
  getCard() {
    return this.deck.pop()
  }
  getNextSuit (suit) {
    const index = this.suits.indexOf(suit)
    const nextIndex = (index + 1) % this.suits.length
    return this.suits[nextIndex]
  }
  isEmpty() {
    return this.deck.length === 0
  }
}
class Updater {
  constructor (upstreamVersionUrl) {
    this.upstreamVersionUrl = upstreamVersionUrl
  }
  getCurrentVersion() {
    return window.asafonov.version
  }
  getUpstreamVersion() {
    return fetch(this.upstreamVersionUrl)
      .then(data => data.text())
      .then(data => data.replace(/[^0-9\.]/g, ''))
  }
  compareVersion (v1, v2) {
    const _v1 = v1.split('.')
    const _v2 = v2.split('.')
    return parseInt(_v1[0], 10) > parseInt(_v2[0], 10) || parseInt(_v1[1], 10) > parseInt(_v2[1], 10)
  }
  getUpdateUrl (template) {
    return template.replace('{VERSION}', this.upstreamVersion)
  }
  isUpdateNeeded() {
    return this.getUpstreamVersion().
      then(upstreamVersion => {
        this.upstreamVersion = upstreamVersion
        const currentVersion = this.getCurrentVersion()
        return this.compareVersion(upstreamVersion, currentVersion)
      })
  }
}
class DurakController {
  constructor (deck) {
    this.deck = deck
    this.my = []
    this.opponent = []
    this.game = []
    this.trump = null
    this.trumpGone = false
    this.opponentMoveTimeout = 600
    this.addCards(this.my, 6)
    this.addCards(this.opponent, 6)
    this.trump = this.deck.getCard()
    this.sort()
    asafonov.messageBus.send(asafonov.events.TRUMP_UPDATED, this.trump)
    asafonov.messageBus.send(asafonov.events.MY_UPDATED, this.my)
    asafonov.messageBus.send(asafonov.events.OPPONENT_UPDATED, this.opponent)
    this.addEventListeners()
    this.resolveFirstMove()
  }
  addEventListeners() {
    this.updateEventListeners(true)
  }
  removeEventListeners() {
    this.removeEventListeners(false)
  }
  updateEventListeners (add) {
    asafonov.messageBus[add ? 'subscribe' : 'unsubscribe'](asafonov.events.CARD_CLICKED, this, 'playerMove')
    asafonov.messageBus[add ? 'subscribe' : 'unsubscribe'](asafonov.events.BTN_CLICKED, this, 'onBtnClicked')
  }
  onBtnClicked (params) {
    if (params.type === 'take') {
      this.playerTakesCards()
      this.addCardsFromDeck(['opponent'])
      setTimeout(() => this.opponentMove(), this.opponentMoveTimeout)
    } else {
      asafonov.messageBus.send(asafonov.events.DONE_BTN_UPDATE, false)
      this.round()
      this.addCardsFromDeck(['my', 'opponent'])
      setTimeout(() => this.opponentMove(), this.opponentMoveTimeout)
    }
  }
  resolveFirstMove() {
    let firstMoveResolved = false
    let currentSuit = this.trump.suit
    while (! firstMoveResolved) {
      const myMin = this.findMinCardOfSuit(this.my, currentSuit)
      const opponentMin = this.findMinCardOfSuit(this.opponent, currentSuit)
      if (opponentMin && myMin) {
        firstMoveResolved = true
        opponentMin.valueD < myMin.valueD && this.opponentMove()
      } else if (! opponentMin && ! myMin) {
        currentSuit = deck.getNextSuit(currentSuit)
      } else {
        firstMoveResolved = true
        opponentMin && this.opponentMove()
      }
    }
  }
  findMinCardOfSuit (arr, suit) {
    let minCard
    for (let i = 0; i < arr.length; ++i) {
      if (arr[i].suit === suit && (! minCard || arr[i].valueD < minCard.valueD)) {
        minCard = arr[i]
      }
    }
    return minCard
  }
  addCards (arr, cnt) {
    for (let i = arr.length; i < cnt; ++i) {
      arr.push(this.deck.getCard())
    }
  }
  sort() {
    const trumps = this.my.filter(a => a.suit === this.trump.suit).sort((a, b) => a.valueD > b.valueD ? 1 : -1)
    const ordinaries = this.my.filter(a => a.suit !== this.trump.suit).sort((a, b) => a.valueD > b.valueD ? 1 : -1)
    this.my = ordinaries.concat(trumps)
  }
  playerMove (index) {
    let cardAllowed = false
    if (this.game.length % 2 === 0) {
      cardAllowed = this.playerContinue(index)
    } else {
      cardAllowed = this.playerReply(index)
    }
    if (cardAllowed) {
      asafonov.messageBus.send(asafonov.events.GAME_UPDATED, this.game)
      asafonov.messageBus.send(asafonov.events.MY_UPDATED, this.my)
      setTimeout(() => this.opponentMove(), this.opponentMoveTimeout)
    }
  }
  playerContinue (index) {
    const card = this.my[index]
    let cardAllowed = this.game.length === 0
    for (let i = 0; i < this.game.length; ++i) {
      if (card.valueD === this.game[i].valueD) {
        cardAllowed = true
        break
      }
    }
    if (cardAllowed) {
      asafonov.messageBus.send(asafonov.events.DONE_BTN_UPDATE, false)
      this.my.splice(index, 1)
      this.game.push(card)
    }
    return cardAllowed
  }
  playerReply (index) {
    const card = this.my[index]
    const cardToBeat = this.game[this.game.length - 1]
    if ((card.valueD > cardToBeat.valueD && card.suit === cardToBeat.suit) || (card.suit === this.trump.suit && cardToBeat.suit !== this.trump.suit)) {
      asafonov.messageBus.send(asafonov.events.TAKE_BTN_UPDATE, false)
      this.my.splice(index, 1)
      this.game.push(card)
      return true
    }
    return false
  }
  playerCanMove() {
    if (this.game.length % 2 === 0) {
      const playerCanContinue = this.playerCanContinue()
      if (! playerCanContinue) {
        this.round()
        this.addCardsFromDeck(['my', 'opponent'])
        setTimeout(() => this.opponentMove(), this.opponentMoveTimeout)
      }
    } else {
      const playerCanReply = this.playerCanReply()
      if (! playerCanReply) {
        this.playerTakesCards()
        this.addCardsFromDeck(['opponent'])
        setTimeout(() => this.opponentMove(), this.opponentMoveTimeout)
      }
    }
  }
  playerCanContinue() {
    let playerCanContinue = this.game.length === 0
    for (let i = 0; i < this.game.length; ++i) {
      for (let j = 0; j < this.my.length; ++j) {
        if (this.my[j].valueD === this.game[i].valueD) {
          playerCanContinue = true
          asafonov.messageBus.send(asafonov.events.DONE_BTN_UPDATE, true)
          break
        }
      }
    }
    return playerCanContinue
  }
  playerCanReply() {
    let playerCanReply = false
    const cardToBeat = this.game[this.game.length - 1]
    for (let i = 0; i < this.my.length; ++i) {
      if ((this.my[i].valueD > cardToBeat.valueD && this.my[i].suit === cardToBeat.suit)
         || (this.my[i].suit === this.trump.suit && cardToBeat.suit !== this.trump.suit)) {
        playerCanReply = true
        asafonov.messageBus.send(asafonov.events.TAKE_BTN_UPDATE, true)
        break
      }
    }
    return playerCanReply
  }
  playerTakesCards() {
    this.my = this.my.concat(this.game)
    this.sort()
    this.game = []
    asafonov.messageBus.send(asafonov.events.GAME_UPDATED, this.game)
    asafonov.messageBus.send(asafonov.events.MY_UPDATED, this.my)
    asafonov.messageBus.send(asafonov.events.TAKE_BTN_UPDATE, false)
  }
  opponentMove() {
    let card
    const opponentStarted = this.game.length % 2 === 0
    if (opponentStarted) {
      card = this.opponentContinue()
    } else {
      card = this.opponentReply()
    }
    if (card) {
      this.opponent.splice(this.opponent.indexOf(card), 1)
      this.game.push(card)
      asafonov.messageBus.send(asafonov.events.OPPONENT_UPDATED, this.opponent)
      setTimeout(() => this.playerCanMove(), this.opponentMoveTimeout)
    } else {
      if (! opponentStarted) {
        this.opponent = this.opponent.concat(this.game)
        asafonov.messageBus.send(asafonov.events.OPPONENT_UPDATED, this.opponent)
      }
      this.game = []
      this.addCardsFromDeck(this.game.length % 2 === 0 ? ['opponent', 'my'] : ['my', 'opponent'])
    }
    asafonov.messageBus.send(asafonov.events.GAME_UPDATED, this.game)
  }
  opponentContinue() {
    let minCard
    for (let i = 0; i < this.opponent.length; ++i) {
      if (! minCard || minCard.valueD > this.opponent[i].valueD || (this.opponent[i].suit !== this.trump.suit && minCard.suit === this.trump.suit)) {
        if (this.game.length === 0) {
          minCard = this.opponent[i]
          continue
        }
        for (let j = 0; j < this.game.length; ++j) {
          if (this.opponent[i].valueD === this.game[j].valueD) {
            minCard = this.opponent[i]
            break
          }
        }
      }
    }
    return minCard
  }
  opponentReply() {
    const cardToBeat = this.game[this.game.length - 1]
    let minCard, minTrumpCard
    for (let i = 0; i < this.opponent.length; ++i) {
      if (this.opponent[i].valueD > cardToBeat.valueD && this.opponent[i].suit === cardToBeat.suit && (! minCard || this.opponent[i].valueD < minCard.value)) {
        minCard = this.opponent[i]
      }
      if (this.opponent[i].suit === this.trump.suit && cardToBeat.suit !== this.trump.suit && (! minTrumpCard || this.opponent[i].valueD < minTrumpCard.valueD)) {
        minTrumpCard = this.opponent[i]
      }
    }
    return minCard || minTrumpCard
  }
  round () {
    this.game = []
    asafonov.messageBus.send(asafonov.events.GAME_UPDATED, this.game)
  }
  giveTrumpAway (arr) {
    arr.push(this.trump)
    this.trumpGone = true
    asafonov.messageBus.send(asafonov.events.TRUMP_UPDATED, false)
  }
  addCardsFromDeck (order) {
    this.isGameOver()
    if (this.trumpGone) return
    for (let i = 0; i < order.length; ++i) {
      if (this.trumpGone) break
      const arr = this[order[i]]
      const length = arr.length
      for (let j = 0; j < 6 - length; ++j) {
        if (! this.deck.isEmpty()) {
          arr.push(this.deck.getCard())
        } else {
          this.giveTrumpAway(arr)
          break
        }
      }
    }
    this.sort()
    asafonov.messageBus.send(asafonov.events.OPPONENT_UPDATED, this.opponent)
    asafonov.messageBus.send(asafonov.events.MY_UPDATED, this.my)
  }
  isGameOver() {
    if (this.my.length === 0 || this.opponent.length === 0) {
      asafonov.messageBus.send(asafonov.events.GAME_OVER, this.my.length === 0)
      return true
    }
    return false
  }
  destroy() {
    this.removeEventListeners()
  }
}
class Swipe {
  constructor (element, minMovement) {
    this.x = null;
    this.y = null;
    this.xn = null;
    this.yn = null;
    this.minMovement = minMovement || 100;
    this.element = element;
    this.onTouchStartProxy = this.onTouchStart.bind(this);
    this.onTouchMoveProxy = this.onTouchMove.bind(this);
    this.onTouchEndProxy = this.onTouchEnd.bind(this);
    this.addEventListeners();
  }
  isMinimalMovement() {
    const xdiff = this.x - this.xn;
    const ydiff = this.y - this.yn;
    return Math.abs(xdiff) > this.minMovement || Math.abs(ydiff) > this.minMovement;
  }
  onTouchStart (event) {
    this.x = event.touches[0].clientX;
    this.y = event.touches[0].clientY;
    this.xn = this.x;
    this.yn = this.y;
    this.swipeStarted = false;
  }
  onTouchMove (event) {
    this.xn = event.touches[0].clientX;
    this.yn = event.touches[0].clientY;
    if (! this.swipeStarted && this.isMinimalMovement()) {
      this.onSwipeStart();
      this.swipeStarted = true;
    }
    this.swipeStarted && this.onSwipeMove();
  }
  onTouchEnd (event) {
    if (! this.isMinimalMovement()) {
      return ;
    }
    this.onSwipeEnd();
    const xdiff = this.x - this.xn;
    const ydiff = this.y - this.yn;
    if (Math.abs(xdiff) > Math.abs(ydiff)) {
      this[xdiff < 0 ? 'onRight' : 'onLeft']();
    } else {
      this[ydiff < 0 ? 'onDown' : 'onUp']();
    }
  }
  onLeft (f) {
    f && (this.onLeft = f);
    return this;
  }
  onRight (f) {
    f && (this.onRight = f);
    return this;
  }
  onUp (f) {
    f && (this.onUp = f);
    return this;
  }
  onDown (f) {
    f && (this.onDown = f);
    return this;
  }
  onSwipeStart (f) {
    f && (this.onSwipeStart = f);
    return this;
  }
  onSwipeMove (f) {
    f && (this.onSwipeMove = f);
    return this;
  }
  onSwipeEnd (f) {
    f && (this.onSwipeEnd = f);
    return this;
  }
  manageEventListeners (remove) {
    const action = remove ? 'removeEventListener' : 'addEventListener';
    this.element[action]('touchstart', this.onTouchStartProxy);
    this.element[action]('touchmove', this.onTouchMoveProxy);
    this.element[action]('touchend', this.onTouchEndProxy);
  }
  addEventListeners() {
    this.manageEventListeners();
  }
  removeEventListeners() {
    this.manageEventListeners(true);
  }
  destroy() {
    this.x = null;
    this.y = null;
    this.xn = null;
    this.yn = null;
    this.minMovement = null;
    this.removeEventListeners();
    this.element = null;
  }
}
class CardView {
  constructor (card) {
    this.model = card
    this.colors = {
      hearts: 'red',
      diamonds: 'red',
      spades: '',
      clubs: ''
    }
    this.suits = {
      hearts: '<div class="hearts"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8.41 9.21"><path d="M5,9.96c.24-.25.24-.25.97-1.02A20.408,20.408,0,0,0,7.89,6.75,5.609,5.609,0,0,0,9.21,3.43a2.9,2.9,0,0,0-.69-1.96A2.067,2.067,0,0,0,6.83.75,1.773,1.773,0,0,0,5,1.8a1.287,1.287,0,0,0-.47-.66A2.269,2.269,0,0,0,3.21.75a2.357,2.357,0,0,0-1.27.36A2.825,2.825,0,0,0,.8,3.44,5.719,5.719,0,0,0,2.01,6.56,28.9,28.9,0,0,0,5,9.96Z" transform="translate(-0.8 -0.75)"/></svg></div>',
      diamonds: '<div class="diamonds"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7.65 9.8"><path d="M5,.3,1.17,5.14,5,10.1,8.82,5.14Z" transform="translate(-1.17 -0.3)"/></svg></div>',
      spades: '<div class="spades"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7.48 9.39"><path d="M5,.35A19.4,19.4,0,0,1,3.1,2.82a10.917,10.917,0,0,0-1.36,1.9,2.9,2.9,0,0,0-.48,1.6A1.958,1.958,0,0,0,3.22,8.46a1.643,1.643,0,0,0,.91-.23,5.439,5.439,0,0,1-1,1.51,10.12,10.12,0,0,1,1.85-.15,10.869,10.869,0,0,1,1.89.15A4.781,4.781,0,0,1,5.85,8.23a1.883,1.883,0,0,0,.97.23,1.776,1.776,0,0,0,1.36-.6,2.083,2.083,0,0,0,.56-1.42,3.493,3.493,0,0,0-.29-1.3A10.086,10.086,0,0,0,6.8,2.71,16.5,16.5,0,0,1,5,.35Z" transform="translate(-1.26 -0.35)"/></svg></div>',
      clubs: '<div class="clubs"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8.87 9.05"><path d="M6.95,9.72a6.927,6.927,0,0,1-.88-1.13A2.387,2.387,0,0,1,5.7,7.55,2.152,2.152,0,0,0,9.44,6.07a2.2,2.2,0,0,0-.46-1.35,2.155,2.155,0,0,0-1.57-.81,4.707,4.707,0,0,0-.59.04,1.927,1.927,0,0,0,.31-1.08,2.151,2.151,0,1,0-4.3.02,2.015,2.015,0,0,0,.3,1.05A3.786,3.786,0,0,0,2.6,3.9a2.2,2.2,0,0,0-1.35.54A2.1,2.1,0,0,0,.57,6.07,2.1,2.1,0,0,0,2.7,8.25a2.005,2.005,0,0,0,1.56-.71,3.081,3.081,0,0,1-.45,1.17,6.342,6.342,0,0,1-.74,1.02,10.7,10.7,0,0,1,1.86-.16,8.731,8.731,0,0,1,.96.04C6.71,9.7,6.71,9.7,6.95,9.72Z" transform="translate(-0.57 -0.68)"/></svg></div>'
    }
    this.values = {
      ace: '<div class="ace"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6.04 6.74"><path d="M6.35,11,3.46,4.26H3.2L.31,11h.96l.81-2H4.57l.82,2ZM4.27,8.26H2.39l.94-2.29Z" transform="translate(-0.31 -4.26)"/></svg></div>',
      jack: '<div class="jack"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2.93 6.76"><path d="M3.05,4.38H2.18V8.94c0,.62-.01,1.44-.72,1.44a1.508,1.508,0,0,1-.98-.56H.31l-.19.76a1.7,1.7,0,0,0,1.31.56c1.31,0,1.62-1,1.62-2.26Z" transform="translate(-0.12 -4.38)"/></svg></div>',
      queen: '<div class="queen"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6.61 8.51"><path d="M6.91,12.57l-.79-.56a2.141,2.141,0,0,1-2.08-.91,3.272,3.272,0,0,0,2.8-3.41A3.233,3.233,0,0,0,3.57,4.24,3.233,3.233,0,0,0,.3,7.69a3.264,3.264,0,0,0,2.64,3.39c.97,1.67,2.4,1.67,3.97,1.67ZM5.95,7.69c0,1.65-.91,2.69-2.38,2.69S1.19,9.34,1.19,7.69,2.1,5,3.57,5,5.95,6.04,5.95,7.69Z" transform="translate(-0.3 -4.24)"/></svg></div>',
      king: '<div class="king"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5.56 6.62"><path d="M6.3,11,2.57,7.43,5.64,4.55V4.38H4.69L1.61,7.25V4.38H.74V11h.87V8.31l.34-.33L5.11,11Z" transform="translate(-0.74 -4.38)"/></svg></div>',
      two: '<div class="two"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4.76 7.28"><path d="M4.6,3.72a2.248,2.248,0,0,0-1.74.72,2.744,2.744,0,0,0-.68,1.91H3a2.178,2.178,0,0,1,.44-1.43,1.365,1.365,0,0,1,1.14-.5,1.575,1.575,0,0,1,1.09.36,1.3,1.3,0,0,1,.39,1.01,1.869,1.869,0,0,1-.55,1.28,10.05,10.05,0,0,1-1.13.89A9.062,9.062,0,0,0,2.83,9.23,2.564,2.564,0,0,0,2.12,11H6.88v-.73H3.13A3.531,3.531,0,0,1,4.69,8.63,10.078,10.078,0,0,0,6.17,7.48a2.432,2.432,0,0,0,.7-1.68,1.948,1.948,0,0,0-.63-1.51A2.409,2.409,0,0,0,4.6,3.72Z" transform="translate(-2.12 -3.72)"/></svg></div>',
      three: '<div class="three"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4.99 7.42"><path d="M4.56,3.72a2.325,2.325,0,0,0-1.65.58,2.348,2.348,0,0,0-.76,1.62h.81a1.689,1.689,0,0,1,.49-1.11,1.538,1.538,0,0,1,1.12-.38,1.528,1.528,0,0,1,1.08.35,1.176,1.176,0,0,1,.38.93,1.176,1.176,0,0,1-.38.93,1.648,1.648,0,0,1-1.09.32H4.01V7.6h.58a1.711,1.711,0,0,1,1.16.35,1.242,1.242,0,0,1,.42,1A1.433,1.433,0,0,1,5.74,10a1.731,1.731,0,0,1-1.23.44,1.735,1.735,0,0,1-1.12-.37,1.656,1.656,0,0,1-.56-1.28H2a2.488,2.488,0,0,0,.85,1.83,2.593,2.593,0,0,0,1.66.52,2.608,2.608,0,0,0,1.81-.63,2.083,2.083,0,0,0,.67-1.59,1.557,1.557,0,0,0-.36-1.05,1.882,1.882,0,0,0-.96-.61,1.559,1.559,0,0,0,1.17-1.6,1.77,1.77,0,0,0-.62-1.42A2.518,2.518,0,0,0,4.56,3.72Z" transform="translate(-2 -3.72)"/></svg></div>',
      four: '<div class="four"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5.53 7.14"><path d="M5.34,3.86,1.73,8.6v.78H5.32V11H6.1V9.38H7.26V8.71H6.1V3.86ZM5.29,4.93h.03V8.71H2.42Z" transform="translate(-1.73 -3.86)"/></svg></div>',
      five: '<div class="five"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4.98 7.28"><path d="M2.52,3.86,2.15,7.8h.77a1.416,1.416,0,0,1,.64-.64,1.83,1.83,0,0,1,.91-.22,1.6,1.6,0,0,1,1.23.47,1.821,1.821,0,0,1,.45,1.32,1.673,1.673,0,0,1-.49,1.23,1.7,1.7,0,0,1-1.24.48,1.784,1.784,0,0,1-1.09-.32,1.457,1.457,0,0,1-.54-1.04H1.98a2.054,2.054,0,0,0,.82,1.55,2.561,2.561,0,0,0,1.61.51,2.586,2.586,0,0,0,1.78-.65,2.28,2.28,0,0,0,.77-1.77,2.513,2.513,0,0,0-.64-1.81,2.2,2.2,0,0,0-1.65-.64,2.27,2.27,0,0,0-.91.17,1.856,1.856,0,0,0-.77.54H2.95l.24-2.39H6.67V3.86Z" transform="translate(-1.98 -3.86)"/></svg></div>',
      six: '<div class="six"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4.99 7.42"><path d="M4.59,3.72A2.163,2.163,0,0,0,2.67,4.84,5.133,5.133,0,0,0,2,7.62a4.453,4.453,0,0,0,.62,2.55,2.227,2.227,0,0,0,1.96.97,2.344,2.344,0,0,0,1.73-.7,2.414,2.414,0,0,0,.68-1.75,2.386,2.386,0,0,0-.62-1.7,2.177,2.177,0,0,0-1.65-.66,2.016,2.016,0,0,0-1.1.3,1.9,1.9,0,0,0-.76.85H2.83v-.3a3.756,3.756,0,0,1,.46-1.97,1.441,1.441,0,0,1,1.29-.8A1.357,1.357,0,0,1,6.06,5.63h.81A2.053,2.053,0,0,0,4.59,3.72ZM4.58,7.01a1.523,1.523,0,0,1,1.17.47,1.7,1.7,0,0,1,.43,1.21,1.886,1.886,0,0,1-.44,1.27,1.538,1.538,0,0,1-1.17.49,1.514,1.514,0,0,1-1.19-.51,1.72,1.72,0,0,1-.44-1.23,1.635,1.635,0,0,1,.47-1.22A1.561,1.561,0,0,1,4.58,7.01Z" transform="translate(-2 -3.72)"/></svg></div>',
      seven: '<div class="seven"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4.69 7.14"><path d="M2.16,3.86v.75H6.02L3.35,11h.88L6.85,4.53V3.86Z" transform="translate(-2.16 -3.86)"/></svg></div>',
      eight: '<div class="eight"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5.16 7.42"><path d="M4.5,3.72a2.466,2.466,0,0,0-1.75.58,1.688,1.688,0,0,0-.58,1.31,1.646,1.646,0,0,0,.27.96,1.623,1.623,0,0,0,.85.62v.02a1.709,1.709,0,0,0-.95.62,1.83,1.83,0,0,0-.42,1.2,1.913,1.913,0,0,0,.66,1.52,2.845,2.845,0,0,0,1.92.59,2.881,2.881,0,0,0,1.92-.59,1.913,1.913,0,0,0,.66-1.52,1.83,1.83,0,0,0-.42-1.2,1.744,1.744,0,0,0-.95-.62V7.19a1.706,1.706,0,0,0,.85-.62,1.646,1.646,0,0,0,.27-.96A1.722,1.722,0,0,0,6.25,4.3,2.482,2.482,0,0,0,4.5,3.72Zm0,.67a1.724,1.724,0,0,1,1.19.39,1.125,1.125,0,0,1,.37.86,1.2,1.2,0,0,1-.33.88,1.715,1.715,0,0,1-1.23.4,1.682,1.682,0,0,1-1.23-.4,1.2,1.2,0,0,1-.33-.88,1.092,1.092,0,0,1,.37-.86A1.69,1.69,0,0,1,4.5,4.39Zm0,3.17a1.928,1.928,0,0,1,1.34.43,1.364,1.364,0,0,1,.43,1.04,1.335,1.335,0,0,1-.43,1.02,1.957,1.957,0,0,1-1.34.42,1.942,1.942,0,0,1-1.33-.41,1.3,1.3,0,0,1-.44-1.03,1.3,1.3,0,0,1,.44-1.04A1.868,1.868,0,0,1,4.5,7.56Z" transform="translate(-1.92 -3.72)"/></svg></div>',
      nine: '<div class="nine"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4.99 7.42"><path d="M4.41,3.72a2.291,2.291,0,0,0-1.73.7A2.358,2.358,0,0,0,2,6.17a2.331,2.331,0,0,0,.61,1.68,2.163,2.163,0,0,0,1.66.68,2.04,2.04,0,0,0,1.1-.3,2.086,2.086,0,0,0,.76-.85h.03v.3A3.879,3.879,0,0,1,5.7,9.65a1.46,1.46,0,0,1-1.29.8A1.352,1.352,0,0,1,2.93,9.23H2.12A2.048,2.048,0,0,0,4.4,11.14a2.206,2.206,0,0,0,1.92-1.12,5.247,5.247,0,0,0,.67-2.78,4.442,4.442,0,0,0-.63-2.56A2.213,2.213,0,0,0,4.41,3.72Zm.01.69a1.543,1.543,0,0,1,1.19.51,1.765,1.765,0,0,1,.44,1.23,1.691,1.691,0,0,1-.47,1.22,1.592,1.592,0,0,1-1.17.48,1.492,1.492,0,0,1-1.16-.47,1.64,1.64,0,0,1-.44-1.21A1.8,1.8,0,0,1,3.25,4.9,1.5,1.5,0,0,1,4.42,4.41Z" transform="translate(-2 -3.72)"/></svg></div>',
      ten: '<div class="ten"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7.27 7.42"><path d="M1.96,3.86A3.4,3.4,0,0,1,.55,4.91v.82a3.674,3.674,0,0,0,1.23-.86V11h.76V3.86Zm3.73-.14A1.771,1.771,0,0,0,3.97,4.93a6.3,6.3,0,0,0-.4,2.5,6.4,6.4,0,0,0,.4,2.5,1.827,1.827,0,0,0,3.44,0,6.385,6.385,0,0,0,.41-2.5,6.283,6.283,0,0,0-.41-2.5A1.789,1.789,0,0,0,5.69,3.72Zm0,.71a1.085,1.085,0,0,1,1.03.77,5.9,5.9,0,0,1,.32,2.23,6.011,6.011,0,0,1-.32,2.23,1.081,1.081,0,0,1-2.07,0,6.046,6.046,0,0,1-.31-2.23A5.94,5.94,0,0,1,4.65,5.2,1.079,1.079,0,0,1,5.69,4.43Z" transform="translate(-0.55 -3.72)"/></svg></div>'
    }
    this.bigValues = {
      queen: '<div class="big_pic queen"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18.117 33"><path d="M40.112,21.785q-.28,1.617-.4,2.456a9.623,9.623,0,0,1-.218,1.15q-.093.311-.249.249a4.107,4.107,0,0,1-.513-.28,5.816,5.816,0,0,0-.995-.451,5.048,5.048,0,0,0-1.694-.233,6.037,6.037,0,0,0-1.663.2,4.871,4.871,0,0,0-1.446.731.267.267,0,0,1-.233.016.2.2,0,0,1-.109-.2L31.9,21.785q-.062-.187.062-.233a.393.393,0,0,1,.311.047l1.461,1.026q.466-.56.668-.824a.539.539,0,0,1,.389-.264.665.665,0,0,1,.435.28q.249.28.808.808a8.183,8.183,0,0,0,.793-.777.7.7,0,0,1,.4-.3q.171-.016.389.249t.715.824L39.8,21.6a.29.29,0,0,1,.264-.047Q40.174,21.6,40.112,21.785Zm2.021,12.56q-.062.435-.109.793t-.109.637l-.093.591q0,.155-.187.155H38.122q-.28,0-.187-.28l.093-.373a1.632,1.632,0,0,0,.093-.373,4.634,4.634,0,0,1,.093-.466,3.605,3.605,0,0,1-1.088.451,4.983,4.983,0,0,1-1.15.14,4.929,4.929,0,0,1-1.943-.389,5.01,5.01,0,0,1-2.674-2.658A4.468,4.468,0,0,1,31,30.646a4.658,4.658,0,0,1,.4-1.928,5.418,5.418,0,0,1,1.073-1.586,4.862,4.862,0,0,1,3.5-1.461,4.467,4.467,0,0,1,1.959.4.179.179,0,0,0,.124.062l.155.062q.249.155.466.3a2.425,2.425,0,0,1,.4.326,7.421,7.421,0,0,1,2.58,3.249A9.162,9.162,0,0,1,42.133,34.345Zm-.684,8.27a.79.79,0,0,1-.2.56.67.67,0,0,1-.513.218.68.68,0,0,1-.435-.124.787.787,0,0,1,.124.373.735.735,0,0,1-.2.544.658.658,0,0,1-.482.2q-.777,0-.777-.746a.787.787,0,0,1,.124-.373.787.787,0,0,1-.373.124.687.687,0,0,1-.777-.777.636.636,0,0,1,.218-.482.755.755,0,0,1,.933-.078.737.737,0,0,1-.124-.466.563.563,0,0,1,.5-.622V40.19H38.34q-.249,0-.249-.218t.249-.218h.435a1.054,1.054,0,0,1-.373-.9,1.334,1.334,0,0,1,.373-.933,1.252,1.252,0,0,1,.964-.4,1.485,1.485,0,0,1,.9.435,1.228,1.228,0,0,1,.373.9,1.018,1.018,0,0,1-.4.9h.466q.249,0,.249.218t-.249.218h-1.15v.777a.563.563,0,0,1,.5.622.737.737,0,0,1-.124.466.68.68,0,0,1,.435-.124.7.7,0,0,1,.513.2A.658.658,0,0,1,41.449,42.615ZM38.526,41.03a4.524,4.524,0,0,1-1.508.933,4.852,4.852,0,0,1-1.757.342q-.249.062-.249-.14t.249-.233a5.242,5.242,0,0,0,1.6-.389,4.866,4.866,0,0,0,1.415-.886.175.175,0,0,1,.3.016Q38.713,40.843,38.526,41.03ZM31,34.159a4.641,4.641,0,0,0-2.985,1.275.189.189,0,0,1-.311-.016q-.155-.171.062-.389a5.106,5.106,0,0,1,1.492-.917A4.552,4.552,0,0,1,31,33.755q.218-.031.218.171A.219.219,0,0,1,31,34.159Zm-2.674-.777a.79.79,0,0,1-.2.56.636.636,0,0,1-.482.218.737.737,0,0,1-.466-.124.787.787,0,0,1,.124.373.6.6,0,0,1-.5.684v.715l1.15.062q.249.031.249.233t-.249.2H27.49a1.069,1.069,0,0,1,.4.9,1.334,1.334,0,0,1-.373.933,1.008,1.008,0,0,1-.9.342,1.3,1.3,0,0,1-.964-.373,1.228,1.228,0,0,1-.373-.9,1.165,1.165,0,0,1,.373-.9H25.22q-.249,0-.249-.2t.249-.233l1.15-.062v-.715a.607.607,0,0,1-.529-.684.787.787,0,0,1,.124-.373.787.787,0,0,1-.373.124.687.687,0,0,1-.777-.777.636.636,0,0,1,.218-.482.755.755,0,0,1,.933-.078.737.737,0,0,1-.124-.466.636.636,0,0,1,.218-.482.79.79,0,0,1,.56-.2.69.69,0,0,1,.684.684.737.737,0,0,1-.124.466.737.737,0,0,1,.466-.124.69.69,0,0,1,.684.684Zm6.933,12.032a4.817,4.817,0,0,1-.389,1.928,5.18,5.18,0,0,1-1.057,1.586,5.1,5.1,0,0,1-5.487,1.088.179.179,0,0,0-.124-.062l-.124-.062q-.249-.155-.482-.311a2.743,2.743,0,0,1-.42-.342,7.308,7.308,0,0,1-2.565-3.249,9.577,9.577,0,0,1-.482-4.275q.062-.435.093-.793a4.928,4.928,0,0,1,.093-.637l.124-.591a.165.165,0,0,1,.187-.187h3.513q.28,0,.187.311l-.093.373a1.246,1.246,0,0,0-.078.373,2.734,2.734,0,0,1-.078.466,3.7,3.7,0,0,1,1.057-.42,5.111,5.111,0,0,1,1.181-.14,4.817,4.817,0,0,1,1.928.389,5.18,5.18,0,0,1,1.586,1.057,4.862,4.862,0,0,1,1.073,1.57A4.468,4.468,0,0,1,35.262,45.413Zm-.871,8.861q.093.4-.4.187l-1.461-1.026q-.466.56-.668.824t-.373.264q-.171,0-.42-.28t-.808-.808q-.56.529-.808.808t-.42.28q-.171,0-.373-.264t-.7-.824L26.495,54.46a.317.317,0,0,1-.28.047q-.124-.047-.062-.233.28-1.617.389-2.456a6.646,6.646,0,0,1,.218-1.15q.109-.311.264-.233t.513.3a5.816,5.816,0,0,0,.995.451,5.165,5.165,0,0,0,1.725.233,5.509,5.509,0,0,0,1.632-.218,5.654,5.654,0,0,0,1.477-.746.2.2,0,0,1,.2-.016.2.2,0,0,1,.109.2Zm5.223-31.96q-.622.4-.9.622a.831.831,0,0,1-.451.218q-.171,0-.358-.249t-.653-.777q-.56.5-.808.746a.505.505,0,0,1-.871,0q-.249-.249-.808-.746-.466.529-.668.777t-.358.249a.767.767,0,0,1-.42-.218q-.264-.218-.855-.622l.529,2.736a4.3,4.3,0,0,1,1.4-.668,6.879,6.879,0,0,1,1.648-.171,6.576,6.576,0,0,1,1.586.171,5.011,5.011,0,0,1,1.461.668Zm1.772,13.742a21.851,21.851,0,0,0,.3-2.814,8.253,8.253,0,0,0-.28-2.5,6.358,6.358,0,0,0-1.119-2.207,8.058,8.058,0,0,0-2.223-1.9,11.831,11.831,0,0,1,.855,1.974,6.968,6.968,0,0,1,.311,1.648,8.316,8.316,0,0,1-.062,1.6q-.109.808-.264,1.834a2.767,2.767,0,0,0-.062.529,2.324,2.324,0,0,1-.062.5l-.311,1.337ZM38.4,34.345q.187-1.057.311-1.9a8.663,8.663,0,0,0,.093-1.617,8.85,8.85,0,0,0-.218-1.6,9.068,9.068,0,0,0-.653-1.819,3.036,3.036,0,0,1-.249-.591,1.674,1.674,0,0,0-.187-.435,4,4,0,0,0-.762-.2,5.454,5.454,0,0,0-.762-.047,4.442,4.442,0,0,0-1.788.358A4.51,4.51,0,0,0,31.8,28.889a4.365,4.365,0,0,0-.358,1.757,4.021,4.021,0,0,0,.326,1.757,4.771,4.771,0,0,0,.964,1.446,4.4,4.4,0,0,0,1.446.979,4.553,4.553,0,0,0,1.8.358,4.219,4.219,0,0,0,2.363-.715Zm2.145,4.508a.781.781,0,0,0-.233-.575,1.061,1.061,0,0,0-.575-.3.876.876,0,0,0-.9.871.807.807,0,0,0,.249.591.883.883,0,0,0,.653.249.757.757,0,0,0,.575-.249A.834.834,0,0,0,40.547,38.853Zm-.56,2.736a.22.22,0,0,0-.249-.249q-.342,0-.342.249a.3.3,0,0,0,.342.342Q39.988,41.931,39.988,41.589Zm1.026,1.026q0-.249-.28-.249-.311,0-.311.249a.275.275,0,0,0,.311.311Q41.014,42.926,41.014,42.615Zm-1.026,0a.22.22,0,0,0-.249-.249q-.342,0-.342.249,0,.311.342.311Q39.988,42.926,39.988,42.615Zm-1.026,0a.22.22,0,0,0-.249-.249q-.311,0-.311.249a.275.275,0,0,0,.311.311Q38.962,42.926,38.962,42.615Zm1.026,1.026a.22.22,0,0,0-.249-.249q-.342,0-.342.249,0,.311.342.311Q39.988,43.952,39.988,43.641ZM26.868,32.356a.22.22,0,0,0-.249-.249q-.311,0-.311.249,0,.342.311.342Q26.868,32.7,26.868,32.356Zm1.026,1.026a.22.22,0,0,0-.249-.249q-.342,0-.342.249,0,.311.342.311Q27.894,33.692,27.894,33.381Zm-1.026,0a.22.22,0,0,0-.249-.249q-.311,0-.311.249a.275.275,0,0,0,.311.311Q26.868,33.692,26.868,33.381Zm-1.026,0a.22.22,0,0,0-.249-.249q-.311,0-.311.249a.275.275,0,0,0,.311.311Q25.842,33.692,25.842,33.381Zm1.026,1.026a.22.22,0,0,0-.249-.249q-.311,0-.311.249a.275.275,0,0,0,.311.311Q26.868,34.718,26.868,34.407Zm.56,2.8a.948.948,0,0,0-.233-.622.721.721,0,0,0-.575-.28.832.832,0,0,0-.653.28.914.914,0,0,0-.249.622.807.807,0,0,0,.249.591.883.883,0,0,0,.653.249.572.572,0,0,0,.575-.218A.948.948,0,0,0,27.427,37.206Zm7.4,8.208a4.021,4.021,0,0,0-.326-1.757,4.447,4.447,0,0,0-.979-1.43,4.771,4.771,0,0,0-1.446-.964,4.364,4.364,0,0,0-1.757-.358,4.257,4.257,0,0,0-2.363.684l-.062.124q-.187,1.057-.311,1.9a11.134,11.134,0,0,0-.124,1.632,6.771,6.771,0,0,0,.2,1.617,9.912,9.912,0,0,0,.668,1.819,3.368,3.368,0,0,1,.249.575,1.794,1.794,0,0,0,.187.42,5.02,5.02,0,0,0,.777.218,4.605,4.605,0,0,0,2.534-.3,4.447,4.447,0,0,0,1.43-.979,4.771,4.771,0,0,0,.964-1.446A4.364,4.364,0,0,0,34.827,45.413ZM28.2,49.424a12.987,12.987,0,0,1-.824-1.99,7.166,7.166,0,0,1-.311-1.648,9.072,9.072,0,0,1,.047-1.586q.093-.808.249-1.834a2.38,2.38,0,0,0,.062-.513,2.38,2.38,0,0,1,.062-.513,7.044,7.044,0,0,0,.2-.731q.078-.358.14-.606H24.878a21.888,21.888,0,0,0-.3,2.829,8.318,8.318,0,0,0,.28,2.518,6.358,6.358,0,0,0,1.119,2.207A7.659,7.659,0,0,0,28.2,49.424Zm5.1,1.586a4.268,4.268,0,0,1-1.415.668,6.924,6.924,0,0,1-1.632.171,6.772,6.772,0,0,1-1.6-.171,4.965,4.965,0,0,1-1.477-.668l-.5,2.767q.622-.4.9-.622a.831.831,0,0,1,.451-.218q.171,0,.358.249t.653.777q.56-.5.808-.746a.478.478,0,0,1,.839,0q.249.249.808.746.466-.529.668-.777t.358-.249a.767.767,0,0,1,.42.218q.264.218.855.622Zm4.819-22.2a3.16,3.16,0,0,1-.389.684.785.785,0,0,1-.668.311.9.9,0,0,1-.746-.311,1.773,1.773,0,0,1-.342-.684.764.764,0,0,0,.28.062h.28a1.836,1.836,0,0,1,.5-.093,1.535,1.535,0,0,1,.466.093h.3A1.053,1.053,0,0,0,38.122,28.811Zm-2.985,2.363A.178.178,0,0,1,34.951,31a1.618,1.618,0,0,1,0-.451,6.33,6.33,0,0,1,.109-.637q.078-.358.14-.731,0-.187.233-.155t.171.28l-.218,1.4h.466q.249.062.249.264t-.249.2Zm-.124-2.363a2.834,2.834,0,0,1-.4.684.828.828,0,0,1-.684.311.862.862,0,0,1-.715-.311,2.2,2.2,0,0,1-.373-.684.8.8,0,0,0,.3.062h.3a1.535,1.535,0,0,1,.466-.093,1.836,1.836,0,0,1,.5.093h.3A1.053,1.053,0,0,0,35.013,28.811Zm1.275,3.606a.293.293,0,0,1-.124.2.921.921,0,0,1-.3.171q-.171.062-.326.109a.905.905,0,0,1-.218.047,1.9,1.9,0,0,1-.591-.155q-.4-.155-.4-.373a.22.22,0,0,1,.249-.249.53.53,0,0,1,.28.171.664.664,0,0,0,.466.171.624.624,0,0,0,.435-.171.53.53,0,0,1,.28-.171A.22.22,0,0,1,36.288,32.418ZM31.967,43.641a.22.22,0,0,1-.249.249.612.612,0,0,1-.3-.155.767.767,0,0,0-.482-.155.6.6,0,0,0-.42.155.482.482,0,0,1-.264.155q-.28,0-.28-.249a.251.251,0,0,1,.124-.187,1.216,1.216,0,0,1,.28-.155,3.013,3.013,0,0,1,.326-.109,1.094,1.094,0,0,1,.233-.047,2.032,2.032,0,0,1,.606.155Q31.967,43.455,31.967,43.641Zm1.461,3.637a.8.8,0,0,0-.3-.062h-.3a1.213,1.213,0,0,1-.933,0h-.311a1.089,1.089,0,0,0-.342.062,2.669,2.669,0,0,1,.4-.715.828.828,0,0,1,.684-.311.9.9,0,0,1,.746.311A1.763,1.763,0,0,1,33.428,47.279Zm-2.3-2.425a.2.2,0,0,1,.218.187,1.556,1.556,0,0,1-.016.482q-.047.3-.124.653t-.14.7q0,.218-.218.171t-.155-.3l.187-1.4-.435-.062q-.249,0-.249-.218t.249-.218Zm-.808,2.425a.8.8,0,0,0-.3-.062h-.3a1.534,1.534,0,0,1-.466.093,1.836,1.836,0,0,1-.5-.093h-.3a1.053,1.053,0,0,0-.326.062,2.669,2.669,0,0,1,.4-.715.828.828,0,0,1,.684-.311.862.862,0,0,1,.715.311A2.139,2.139,0,0,1,30.319,47.279Z" transform="translate(-24.08 -21.536)"/></svg></div>',
      king: '<div class="big_pic king"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21.382 33"><path d="M39.2,26.331a.192.192,0,0,1-.168.214.231.231,0,0,1-.26-.153,5.081,5.081,0,0,0-1.961-2.114,5.749,5.749,0,0,0-2.818-.643,5.058,5.058,0,0,0-4.84,2.941q-.092.184-.23.153t-.138-.214V20.6q0-.551.368-.123l1.011,1.44q.521-.766.751-1.164t.414-.383q.184.015.429.414t.8,1.195q.643-.8.919-1.195t.49-.4q.214,0,.49.4t.919,1.195q.551-.8.8-1.195t.429-.414q.184-.015.414.383t.751,1.164l1.011-1.44q.153-.184.291-.153t.138.276Zm1.93,8.761a1.053,1.053,0,0,1,.4.888,1.132,1.132,0,0,1-.138.536,1.353,1.353,0,0,1-.322.414V38.8q0,.245-.184.245H39.625a.217.217,0,0,1-.245-.245V36.93a1.193,1.193,0,0,1-.429-.95,1.148,1.148,0,0,1,.368-.888H38.89q-.245,0-.245-.214t.245-.214l.551-.061V27.893l.827-1.256.858,1.256V34.6l.46.061q.245,0,.245.214t-.245.214Zm-2.3-5.575A4.585,4.585,0,0,1,38,32.243,5.054,5.054,0,0,1,35.8,33.989l-.429,1.1q-.092.245-.276.153A.182.182,0,0,1,35,34.97l.245-.735a1.1,1.1,0,0,0-.23.031,1.339,1.339,0,0,1-.291.031l-.184.8a.2.2,0,0,1-.26.168q-.2-.046-.107-.291l.123-.613a1.008,1.008,0,0,1-.306.061v.613q0,.245-.214.245t-.214-.245v-.613a.19.19,0,0,0-.138-.061h-.138l.123.613q.061.245-.123.291t-.245-.168l-.245-.8a.681.681,0,0,0-.214-.092,2.173,2.173,0,0,1-.276-.092l.306.858a.182.182,0,0,1-.107.276q-.2.092-.26-.153L31.722,33.9a4.873,4.873,0,0,1-1.961-1.761,4.978,4.978,0,0,1-.352-4.518A4.977,4.977,0,0,1,32.028,25a4.747,4.747,0,0,1,1.9-.383A4.671,4.671,0,0,1,35.8,25a4.97,4.97,0,0,1,1.562,1.057,5.192,5.192,0,0,1,1.072,1.562A4.59,4.59,0,0,1,38.829,29.517Zm-.4,9.221a14.948,14.948,0,0,1-1.179.965,8.283,8.283,0,0,1-1.179.72,7.834,7.834,0,0,1-1.287.505,11.008,11.008,0,0,1-1.5.322q-.184.061-.245-.153t.184-.276q.766-.184,1.424-.368a8.23,8.23,0,0,0,1.225-.444,7.32,7.32,0,0,0,1.118-.643,9.756,9.756,0,0,0,1.133-.934.217.217,0,1,1,.306.306Zm-9.4-5.943q-.8.153-1.44.322a6.553,6.553,0,0,0-1.21.444,8.417,8.417,0,0,0-1.118.659,9.756,9.756,0,0,0-1.133.934.217.217,0,0,1-.306-.306,13.4,13.4,0,0,1,1.195-.965,8.359,8.359,0,0,1,1.179-.7,8.205,8.205,0,0,1,1.271-.49,14.889,14.889,0,0,1,1.5-.352q.184-.061.245.168T29.026,32.795Zm4.2,11.273a4.747,4.747,0,0,1-.383,1.9A5.1,5.1,0,0,1,31.8,47.529a4.791,4.791,0,0,1-3.446,1.44,4.672,4.672,0,0,1-1.869-.383,4.97,4.97,0,0,1-1.562-1.057,5.192,5.192,0,0,1-1.072-1.562,4.732,4.732,0,0,1,.444-4.6,4.928,4.928,0,0,1,2.16-1.746l.429-1.133q.092-.245.291-.153a.182.182,0,0,1,.107.276l-.245.766a.9.9,0,0,0,.214-.031,1.139,1.139,0,0,1,.276-.031l.184-.827a.211.211,0,0,1,.26-.153q.2.031.107.276l-.123.643a1.073,1.073,0,0,1,.337-.061v-.643q0-.245.214-.245t.214.245V39.2a.177.177,0,0,0,.123.061h.123l-.123-.643q-.061-.245.123-.276a.2.2,0,0,1,.245.153l.245.827a1.2,1.2,0,0,0,.245.092,2.173,2.173,0,0,1,.276.092l-.306-.888q-.123-.184.092-.276t.276.153l.49,1.195a4.892,4.892,0,0,1,2.7,4.381ZM22.807,38.921l.061,6.8-.858,1.225-.827-1.225-.061-6.8h-.429q-.245,0-.245-.214t.245-.214h.429a1.038,1.038,0,0,1-.368-.888,1.161,1.161,0,0,1,.429-.919v-1.9q0-.245.184-.245h1.256a.217.217,0,0,1,.245.245v1.9a1.079,1.079,0,0,1,.46.919,1,1,0,0,1-.4.888h.46q.245,0,.245.214t-.245.214Zm10.66,14.061q0,.551-.368.123l-1.011-1.44q-.521.8-.735,1.179t-.4.383q-.184,0-.429-.414t-.8-1.21a10.666,10.666,0,0,0-.965,1.21q-.26.414-.46.414t-.475-.414a14.914,14.914,0,0,0-.95-1.21q-.551.8-.8,1.21t-.429.414q-.184,0-.4-.383t-.735-1.179L23.512,53.1q-.153.184-.291.153t-.138-.276v-5.7a.214.214,0,0,1,.168-.23q.168-.046.26.168a5.178,5.178,0,0,0,4.779,2.757A5.074,5.074,0,0,0,33.1,47.039q.092-.214.23-.184t.138.245Zm5.3-31.675q-.459.7-.689,1.011t-.4.26q-.168-.046-.4-.444T36.562,21q-.551.8-.781,1.179t-.414.368q-.184-.015-.46-.414t-.919-1.195q-.643.8-.934,1.195t-.475.414q-.184.015-.429-.368T31.354,21q-.49.735-.72,1.133t-.383.444q-.153.046-.368-.276t-.674-1v4.381a5.515,5.515,0,0,1,1.961-1.869,5.749,5.749,0,0,1,2.818-.643,6.174,6.174,0,0,1,2.711.582A5.532,5.532,0,0,1,38.767,25.5ZM40.7,34.6V27.955l-.429-.643-.4.643V34.6Zm-2.328-5.085a4.3,4.3,0,0,0-.352-1.731,4.443,4.443,0,0,0-2.359-2.359,4.428,4.428,0,0,0-3.462,0,4.7,4.7,0,0,0-1.424.95,4.382,4.382,0,0,0-.965,1.409,4.465,4.465,0,0,0,.184,3.86,4.4,4.4,0,0,0,1.486,1.578l-.368-1.011a.182.182,0,0,1,.092-.276q.184-.092.276.153l.551,1.44.7.245-.368-1.562q-.092-.245.107-.276a.211.211,0,0,1,.26.153l.429,1.807a1.116,1.116,0,0,1,.184.015.783.783,0,0,1,.214.077V32.151q0-.245.214-.245t.214.245v1.838a.624.624,0,0,0,.214-.046.624.624,0,0,1,.214-.046l.46-1.807a.2.2,0,0,1,.245-.153q.184.031.123.276l-.368,1.624a1.746,1.746,0,0,1,.306-.092,1.746,1.746,0,0,0,.306-.092l.643-1.562q.061-.245.26-.153a.182.182,0,0,1,.107.276l-.46,1.195a4.156,4.156,0,0,0,1.7-1.608A4.39,4.39,0,0,0,38.369,29.517Zm2.7,6.464a.934.934,0,0,0-.23-.613.71.71,0,0,0-.567-.276.819.819,0,0,0-.643.276.9.9,0,0,0-.245.613.8.8,0,0,0,.245.582.87.87,0,0,0,.643.245.746.746,0,0,0,.567-.245A.822.822,0,0,0,41.065,35.981Zm-.429,1.195a1.156,1.156,0,0,1-.368.061,1.472,1.472,0,0,1-.46-.061v1.379h.827ZM22.44,34.97h-.827v1.44a.911.911,0,0,1,.46-.123.775.775,0,0,1,.368.123Zm.429,2.634a.877.877,0,0,0-.23-.6.726.726,0,0,0-.567-.26.863.863,0,0,0-.888.858.8.8,0,0,0,.245.582.87.87,0,0,0,.643.245.746.746,0,0,0,.567-.245A.822.822,0,0,0,22.869,37.6Zm9.925,6.464a4.31,4.31,0,0,0-.536-2.129,4.4,4.4,0,0,0-1.486-1.578l.4,1.011a.182.182,0,0,1-.107.276q-.2.092-.291-.153l-.551-1.44q-.153-.061-.322-.123t-.383-.123l.4,1.562q.092.245-.123.276a.222.222,0,0,1-.276-.153l-.429-1.807a1.156,1.156,0,0,1-.368-.061v1.807q0,.245-.214.245t-.214-.245V39.626a1.007,1.007,0,0,0-.245.031.9.9,0,0,1-.214.031L27.4,41.495a.2.2,0,0,1-.245.153q-.184-.031-.123-.276l.368-1.624a1.666,1.666,0,0,1-.322.092,1.666,1.666,0,0,0-.322.092l-.613,1.562q-.061.245-.276.138t-.092-.26l.429-1.195A4.584,4.584,0,0,0,24.523,41.8a4.233,4.233,0,0,0-.643,2.267,4.3,4.3,0,0,0,.352,1.731,4.555,4.555,0,0,0,2.389,2.389,4.3,4.3,0,0,0,1.731.352,4.193,4.193,0,0,0,1.715-.352,4.616,4.616,0,0,0,1.409-.965,4.564,4.564,0,0,0,.965-1.424A4.3,4.3,0,0,0,32.794,44.068ZM22.379,45.63V38.921h-.827V45.63l.46.643ZM33.039,47.9a5.474,5.474,0,0,1-1.976,1.869,5.7,5.7,0,0,1-2.772.643,5.5,5.5,0,0,1-4.779-2.328v4.227L24.2,51.3q.23-.337.4-.291t.4.444q.23.4.72,1.164.551-.8.781-1.195t.414-.383q.184.015.46.429t.919,1.21q.643-.827.934-1.225t.475-.414q.184-.015.414.383t.812,1.195q.49-.766.7-1.164T32,51.006q.153-.046.368.291t.674,1.011ZM36.684,27.71a2.792,2.792,0,0,1-.4.674.816.816,0,0,1-.674.306.894.894,0,0,1-.72-.306,1.649,1.649,0,0,1-.352-.674A4.876,4.876,0,0,0,35.6,27.8,5.328,5.328,0,0,0,36.684,27.71ZM33.345,30.1q-.245,0-.245-.23t.245-.23h.827l-.306-1.44q-.061-.245.153-.276a.222.222,0,0,1,.276.153q.184.858.352,1.44t-.168.582Zm.276-2.389a2.792,2.792,0,0,1-.4.674.816.816,0,0,1-.674.306.885.885,0,0,1-.735-.306,1.747,1.747,0,0,1-.337-.674,4.536,4.536,0,0,0,1.042.092A5.422,5.422,0,0,0,33.621,27.71Zm2.941,2.88a.958.958,0,0,1-.414.858,1.424,1.424,0,0,1-.781.276,1.474,1.474,0,0,1-.613-.092.694.694,0,0,1-.276-.23q-.092-.138-.2-.276a.783.783,0,0,0-.352-.23,1.206,1.206,0,0,0-.429.23,3.509,3.509,0,0,0-.276.276,1.683,1.683,0,0,1-.245.23.5.5,0,0,1-.306.092,1.81,1.81,0,0,1-1.026-.276.958.958,0,0,1-.414-.858q0-.245.214-.245t.214.245a.609.609,0,0,0,.23.475.793.793,0,0,0,.536.2.752.752,0,0,0,.414-.092,1.708,1.708,0,0,0,.26-.214q.123-.123.291-.26a1.371,1.371,0,0,1,.475-.23.467.467,0,0,1,.505.168q.26.26.414.444a.4.4,0,0,0,.26.168,2.953,2.953,0,0,0,.322.015.9.9,0,0,0,.521-.168.573.573,0,0,0,.245-.505q0-.245.214-.245T36.562,30.589ZM31.048,43q0,.245-.23.245T30.588,43a.609.609,0,0,0-.23-.475.755.755,0,0,0-.505-.2.836.836,0,0,0-.429.092,1.179,1.179,0,0,0-.276.23,3.508,3.508,0,0,1-.276.276,1.2,1.2,0,0,1-.459.23.488.488,0,0,1-.521-.184q-.276-.276-.429-.46a.309.309,0,0,0-.23-.168,3.3,3.3,0,0,0-.352-.015.836.836,0,0,0-.505.168.586.586,0,0,0-.23.505q0,.245-.214.245T25.718,43a.939.939,0,0,1,.4-.827,1.354,1.354,0,0,1,.766-.276,1.474,1.474,0,0,1,.613.092.938.938,0,0,1,.291.214,2.5,2.5,0,0,1,.2.26.691.691,0,0,0,.368.23,1.239,1.239,0,0,0,.4-.23q.153-.138.276-.26a1.708,1.708,0,0,1,.26-.214.566.566,0,0,1,.322-.092,1.81,1.81,0,0,1,1.026.276A.928.928,0,0,1,31.048,43Zm-.276,2.91a4.449,4.449,0,0,0-1.026-.092,5.328,5.328,0,0,0-1.087.092,2.63,2.63,0,0,1,.4-.7.816.816,0,0,1,.674-.306.85.85,0,0,1,.7.306A1.737,1.737,0,0,1,30.772,45.906Zm-2.7-1.961.337,1.44q.061.245-.168.276a.234.234,0,0,1-.291-.153q-.092-.429-.2-.8a6.077,6.077,0,0,1-.153-.628,1.169,1.169,0,0,1-.015-.414.17.17,0,0,1,.184-.153H28.9q.245,0,.245.214t-.245.214Zm-.368,1.961a4.536,4.536,0,0,0-1.042-.092,5.422,5.422,0,0,0-1.1.092,2.63,2.63,0,0,1,.4-.7.816.816,0,0,1,.674-.306.885.885,0,0,1,.735.306A1.737,1.737,0,0,1,27.709,45.906Z" transform="translate(-20.449 -20.292)"/></svg></div>',
      jack: '<div class="big_pic jack"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22.543 33"><path d="M39.162,27.867q-.065.258-.194.291t-.258-.226a4.507,4.507,0,0,0-4.586-2.971,4.7,4.7,0,0,0-4.618,2.971q-.129.258-.242.226t-.145-.291L28.8,22.635a.247.247,0,0,1,.081-.178.127.127,0,0,1,.178-.016q.452.065.9.1l.9.065q.775.065,1.647.113t1.615.048q.743,0,1.6-.032t1.631-.1l1.809-.194a.127.127,0,0,1,.178.016.247.247,0,0,1,.081.178ZM42.327,37.1a1.11,1.11,0,0,1,.42.937,1.194,1.194,0,0,1-.145.565,1.427,1.427,0,0,1-.339.436v1.97q0,.258-.194.258H40.745a.228.228,0,0,1-.258-.258v-1.97a1.258,1.258,0,0,1-.452-1,1.21,1.21,0,0,1,.388-.937H39.97q-.258,0-.258-.226t.258-.226l.581-.065a15.539,15.539,0,0,1-.484-2.616,14.724,14.724,0,0,1-.081-2.309,4.778,4.778,0,0,1,.565-2.148,6.219,6.219,0,0,0,.307-.888.53.53,0,0,1,.565-.436.521.521,0,0,1,.355.113.816.816,0,0,1,.21.307,3.444,3.444,0,0,1,.145.436,1.958,1.958,0,0,0,.194.468,5.228,5.228,0,0,1,.549,2.148,13.571,13.571,0,0,1-.065,2.309,21.515,21.515,0,0,1-.484,2.616l.484.065q.258,0,.258.226t-.258.226Zm-2.713-5.943a.319.319,0,0,1,.032.307.229.229,0,0,1-.226.145l-.969.226a7.263,7.263,0,0,1-.307,1.615,5.129,5.129,0,0,1-.694,1.421l.194,1.518q0,.258-.226.258t-.226-.258l-.129-1.066-.42.323.194.872q.1.258-.113.291a.222.222,0,0,1-.275-.161l-.194-.646-.388.194.194.581q.1.194-.129.291t-.291-.161l-.258-.581a1.644,1.644,0,0,0-.323.032,1.643,1.643,0,0,1-.323.032,4.925,4.925,0,0,1-1.97-.4,5.24,5.24,0,0,1-1.647-1.114,5.474,5.474,0,0,1-1.13-1.647,4.839,4.839,0,0,1-.42-2,5,5,0,0,1,.4-2,5.247,5.247,0,0,1,2.761-2.761,5,5,0,0,1,2-.4,2.935,2.935,0,0,1,2.228.92,5.407,5.407,0,0,1,1.26,2.277.057.057,0,0,0,.065.065Zm-.129,9.786a15.76,15.76,0,0,1-1.243,1.017A8.731,8.731,0,0,1,37,42.724a8.258,8.258,0,0,1-1.356.533,11.606,11.606,0,0,1-1.583.339q-.194.065-.258-.161t.194-.291q.807-.194,1.5-.388a8.677,8.677,0,0,0,1.292-.468,7.718,7.718,0,0,0,1.179-.678,10.286,10.286,0,0,0,1.195-.985.228.228,0,0,1,.323.323ZM29.57,34.682q-.84.161-1.518.339a6.91,6.91,0,0,0-1.276.468,8.874,8.874,0,0,0-1.179.694,10.285,10.285,0,0,0-1.195.985.228.228,0,0,1-.323-.323,14.123,14.123,0,0,1,1.26-1.017,8.813,8.813,0,0,1,1.243-.743,8.651,8.651,0,0,1,1.34-.517,15.7,15.7,0,0,1,1.583-.371q.194-.065.258.178T29.57,34.682Zm4.425,11.885a5,5,0,0,1-.4,2,5.381,5.381,0,0,1-1.1,1.647,5.051,5.051,0,0,1-3.633,1.518,2.961,2.961,0,0,1-2.245-.937,5.472,5.472,0,0,1-1.276-2.228.057.057,0,0,0-.065-.065l-1.324-1.873a.319.319,0,0,1-.032-.307.229.229,0,0,1,.226-.145l1-.194a7.264,7.264,0,0,1,.307-1.615,5.129,5.129,0,0,1,.694-1.421l-.226-1.518q0-.258.242-.258t.242.258l.129,1.033a1.555,1.555,0,0,1,.388-.323l-.194-.872q-.1-.258.113-.291a.222.222,0,0,1,.275.161l.194.678a1.49,1.49,0,0,0,.42-.194l-.194-.614q-.129-.194.1-.291t.291.161l.258.614a1.9,1.9,0,0,0,.339-.032,1.9,1.9,0,0,1,.339-.032,4.925,4.925,0,0,1,1.97.4,5.182,5.182,0,0,1,1.631,1.1,5.414,5.414,0,0,1,1.114,1.631A4.839,4.839,0,0,1,33.995,46.567ZM23.014,41.141a19,19,0,0,1,.517,2.681,14.022,14.022,0,0,1,.065,2.342,5.579,5.579,0,0,1-.517,2.148,3.718,3.718,0,0,0-.371.872.508.508,0,0,1-.533.42.527.527,0,0,1-.565-.42,6.53,6.53,0,0,0-.307-.872,4.929,4.929,0,0,1-.581-2.148,14.023,14.023,0,0,1,.065-2.342q.065-.646.178-1.308t.275-1.373h-.452q-.258,0-.258-.226t.258-.226h.452a1.094,1.094,0,0,1-.388-.937,1.224,1.224,0,0,1,.452-.969v-2q0-.258.194-.258H22.82a.228.228,0,0,1,.258.258v2a1.138,1.138,0,0,1,.484.969,1.058,1.058,0,0,1-.42.937h.484q.258,0,.258.226t-.258.226ZM34.8,55.158a.284.284,0,0,1-.081.21.127.127,0,0,1-.178.016l-1.809-.194q-.775-.065-1.663-.145t-1.631-.081q-.743,0-1.6.081t-1.631.145l-1.809.194a.127.127,0,0,1-.178-.016.284.284,0,0,1-.081-.21l.258-5.2q.065-.258.21-.291t.275.226A4.485,4.485,0,0,0,29.441,52.8a5.808,5.808,0,0,0,2.826-.759,4.594,4.594,0,0,0,1.792-2.148q.129-.258.258-.226t.161.291Zm4.166-32.264-.872.1q-.581.065-1.26.113t-1.4.081q-.727.032-1.308.032-.614-.032-1.34-.065t-1.421-.081q-.694-.048-1.26-.1t-.856-.081l.258,4.1a5.113,5.113,0,0,1,4.618-2.519A4.846,4.846,0,0,1,38.71,27Zm2.907,13.694a16.078,16.078,0,0,0,.517-2.616,13.571,13.571,0,0,0,.065-2.309,4.5,4.5,0,0,0-.581-2.083.744.744,0,0,1-.178-.436.239.239,0,0,0-.275-.242.258.258,0,0,0-.291.242,1.374,1.374,0,0,1-.129.436,4.394,4.394,0,0,0-.63,2.083,10.876,10.876,0,0,0,.081,2.309q.1.646.226,1.308T41,36.587Zm.388,1.453a.985.985,0,0,0-.242-.646.749.749,0,0,0-.6-.291.864.864,0,0,0-.678.291.949.949,0,0,0-.258.646.838.838,0,0,0,.258.614.917.917,0,0,0,.678.258.787.787,0,0,0,.6-.258A.867.867,0,0,0,42.263,38.041Zm-3.23-6.879-1.26-1.647a1.057,1.057,0,0,0-.065-.258,4.007,4.007,0,0,0-1.017-1.922,2.588,2.588,0,0,0-1.954-.791,4.534,4.534,0,0,0-1.825.371,4.956,4.956,0,0,0-1.5,1A4.62,4.62,0,0,0,30.394,29.4a4.668,4.668,0,0,0,0,3.65,4.8,4.8,0,0,0,2.519,2.519,4.534,4.534,0,0,0,1.825.371.658.658,0,0,0,.226-.048.823.823,0,0,1,.291-.048l-.129-.258q-.1-.258.129-.323a.246.246,0,0,1,.323.129l.065.323q.161-.065.275-.1a.745.745,0,0,0,.21-.1l-.065-.452q-.065-.258.145-.291a.269.269,0,0,1,.307.161V35.2a4.081,4.081,0,0,0,1.066-1.437,4.773,4.773,0,0,0,.388-1.986V31.42ZM41.811,39.3a1.219,1.219,0,0,1-.388.065,1.552,1.552,0,0,1-.484-.065v1.453h.872ZM22.626,36.975h-.872v1.518a.961.961,0,0,1,.484-.129.817.817,0,0,1,.388.129Zm10.916,9.592a4.534,4.534,0,0,0-.371-1.825,4.62,4.62,0,0,0-1.017-1.486,5.015,5.015,0,0,0-1.486-1,4.421,4.421,0,0,0-1.809-.371,1.062,1.062,0,0,0-.258.032,1.2,1.2,0,0,1-.291.032l.129.258q.1.258-.129.323a.246.246,0,0,1-.323-.129l-.065-.323q-.161.065-.258.1a.815.815,0,0,0-.194.1l.065.452q.065.258-.161.307a.263.263,0,0,1-.323-.145v-.291a4.369,4.369,0,0,0-1.066,1.486,4.8,4.8,0,0,0-.388,1.97v.323l-1.066.258,1.26,1.679a1.057,1.057,0,0,0,.065.258,4.007,4.007,0,0,0,1.017,1.922,2.627,2.627,0,0,0,1.986.791,4.421,4.421,0,0,0,1.809-.371,4.867,4.867,0,0,0,1.486-1.017,4.811,4.811,0,0,0,1.017-1.5A4.534,4.534,0,0,0,33.543,46.567ZM23.079,39.752a.924.924,0,0,0-.242-.63.766.766,0,0,0-.6-.275.91.91,0,0,0-.937.9.838.838,0,0,0,.258.614.917.917,0,0,0,.678.258.787.787,0,0,0,.6-.258A.867.867,0,0,0,23.079,39.752Zm-.517,8.462a4.419,4.419,0,0,0,.6-2.051,12.987,12.987,0,0,0-.048-2.342,11.38,11.38,0,0,0-.21-1.308q-.145-.662-.339-1.373H21.69a19,19,0,0,0-.517,2.681q-.065.549-.1,1.147a8.594,8.594,0,0,0,.016,1.179,6.175,6.175,0,0,0,.194,1.114,3.628,3.628,0,0,0,.4.953,1.031,1.031,0,0,1,.194.452.253.253,0,0,0,.291.226q.258,0,.275-.226A1.4,1.4,0,0,1,22.562,48.214Zm11.5,2.584a4.489,4.489,0,0,1-1.906,1.825,6.8,6.8,0,0,1-2.713.63,5.332,5.332,0,0,1-2.648-.581A4.819,4.819,0,0,1,24.887,50.8L24.6,54.9l.872-.1q.581-.065,1.26-.145t1.4-.113q.727-.032,1.308-.032.614.032,1.34.081l1.421.1q.694.048,1.276.113l.872.1Zm3.2-20.444a3.514,3.514,0,0,0-1.163-.161,2.953,2.953,0,0,0-1.1.161,1.6,1.6,0,0,1,.355-.743.983.983,0,0,1,.775-.291.9.9,0,0,1,.711.291A2.236,2.236,0,0,1,37.257,30.354ZM28.569,47.439a1.713,1.713,0,0,1-.355.759.917.917,0,0,1-.743.307.879.879,0,0,1-.711-.307,2.439,2.439,0,0,1-.42-.759,3.455,3.455,0,0,0,1.147.161A2.9,2.9,0,0,0,28.569,47.439Z" transform="translate(-20.527 -22.413)"/></svg></div>',
      ace: '<div class="big_pic ace"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6.04 6.74"><path d="M6.35,11,3.46,4.26H3.2L.31,11h.96l.81-2H4.57l.82,2ZM4.27,8.26H2.39l.94-2.29Z" transform="translate(-0.31 -4.26)"/></svg></div>',
      two: '<div class="big_pic two"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4.76 7.28"><path d="M4.6,3.72a2.248,2.248,0,0,0-1.74.72,2.744,2.744,0,0,0-.68,1.91H3a2.178,2.178,0,0,1,.44-1.43,1.365,1.365,0,0,1,1.14-.5,1.575,1.575,0,0,1,1.09.36,1.3,1.3,0,0,1,.39,1.01,1.869,1.869,0,0,1-.55,1.28,10.05,10.05,0,0,1-1.13.89A9.062,9.062,0,0,0,2.83,9.23,2.564,2.564,0,0,0,2.12,11H6.88v-.73H3.13A3.531,3.531,0,0,1,4.69,8.63,10.078,10.078,0,0,0,6.17,7.48a2.432,2.432,0,0,0,.7-1.68,1.948,1.948,0,0,0-.63-1.51A2.409,2.409,0,0,0,4.6,3.72Z" transform="translate(-2.12 -3.72)"/></svg></div>',
      three: '<div class="big_pic three"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4.99 7.42"><path d="M4.56,3.72a2.325,2.325,0,0,0-1.65.58,2.348,2.348,0,0,0-.76,1.62h.81a1.689,1.689,0,0,1,.49-1.11,1.538,1.538,0,0,1,1.12-.38,1.528,1.528,0,0,1,1.08.35,1.176,1.176,0,0,1,.38.93,1.176,1.176,0,0,1-.38.93,1.648,1.648,0,0,1-1.09.32H4.01V7.6h.58a1.711,1.711,0,0,1,1.16.35,1.242,1.242,0,0,1,.42,1A1.433,1.433,0,0,1,5.74,10a1.731,1.731,0,0,1-1.23.44,1.735,1.735,0,0,1-1.12-.37,1.656,1.656,0,0,1-.56-1.28H2a2.488,2.488,0,0,0,.85,1.83,2.593,2.593,0,0,0,1.66.52,2.608,2.608,0,0,0,1.81-.63,2.083,2.083,0,0,0,.67-1.59,1.557,1.557,0,0,0-.36-1.05,1.882,1.882,0,0,0-.96-.61,1.559,1.559,0,0,0,1.17-1.6,1.77,1.77,0,0,0-.62-1.42A2.518,2.518,0,0,0,4.56,3.72Z" transform="translate(-2 -3.72)"/></svg></div>',
      four: '<div class="big_pic four"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5.53 7.14"><path d="M5.34,3.86,1.73,8.6v.78H5.32V11H6.1V9.38H7.26V8.71H6.1V3.86ZM5.29,4.93h.03V8.71H2.42Z" transform="translate(-1.73 -3.86)"/></svg></div>',
      five: '<div class="big_pic five"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4.98 7.28"><path d="M2.52,3.86,2.15,7.8h.77a1.416,1.416,0,0,1,.64-.64,1.83,1.83,0,0,1,.91-.22,1.6,1.6,0,0,1,1.23.47,1.821,1.821,0,0,1,.45,1.32,1.673,1.673,0,0,1-.49,1.23,1.7,1.7,0,0,1-1.24.48,1.784,1.784,0,0,1-1.09-.32,1.457,1.457,0,0,1-.54-1.04H1.98a2.054,2.054,0,0,0,.82,1.55,2.561,2.561,0,0,0,1.61.51,2.586,2.586,0,0,0,1.78-.65,2.28,2.28,0,0,0,.77-1.77,2.513,2.513,0,0,0-.64-1.81,2.2,2.2,0,0,0-1.65-.64,2.27,2.27,0,0,0-.91.17,1.856,1.856,0,0,0-.77.54H2.95l.24-2.39H6.67V3.86Z" transform="translate(-1.98 -3.86)"/></svg></div>',
      six: '<div class="big_pic six"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4.99 7.42"><path d="M4.59,3.72A2.163,2.163,0,0,0,2.67,4.84,5.133,5.133,0,0,0,2,7.62a4.453,4.453,0,0,0,.62,2.55,2.227,2.227,0,0,0,1.96.97,2.344,2.344,0,0,0,1.73-.7,2.414,2.414,0,0,0,.68-1.75,2.386,2.386,0,0,0-.62-1.7,2.177,2.177,0,0,0-1.65-.66,2.016,2.016,0,0,0-1.1.3,1.9,1.9,0,0,0-.76.85H2.83v-.3a3.756,3.756,0,0,1,.46-1.97,1.441,1.441,0,0,1,1.29-.8A1.357,1.357,0,0,1,6.06,5.63h.81A2.053,2.053,0,0,0,4.59,3.72ZM4.58,7.01a1.523,1.523,0,0,1,1.17.47,1.7,1.7,0,0,1,.43,1.21,1.886,1.886,0,0,1-.44,1.27,1.538,1.538,0,0,1-1.17.49,1.514,1.514,0,0,1-1.19-.51,1.72,1.72,0,0,1-.44-1.23,1.635,1.635,0,0,1,.47-1.22A1.561,1.561,0,0,1,4.58,7.01Z" transform="translate(-2 -3.72)"/></svg></div>',
      seven: '<div class="big_pic seven"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4.69 7.14"><path d="M2.16,3.86v.75H6.02L3.35,11h.88L6.85,4.53V3.86Z" transform="translate(-2.16 -3.86)"/></svg></div>',
      eight: '<div class="big_pic eight"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5.16 7.42"><path d="M4.5,3.72a2.466,2.466,0,0,0-1.75.58,1.688,1.688,0,0,0-.58,1.31,1.646,1.646,0,0,0,.27.96,1.623,1.623,0,0,0,.85.62v.02a1.709,1.709,0,0,0-.95.62,1.83,1.83,0,0,0-.42,1.2,1.913,1.913,0,0,0,.66,1.52,2.845,2.845,0,0,0,1.92.59,2.881,2.881,0,0,0,1.92-.59,1.913,1.913,0,0,0,.66-1.52,1.83,1.83,0,0,0-.42-1.2,1.744,1.744,0,0,0-.95-.62V7.19a1.706,1.706,0,0,0,.85-.62,1.646,1.646,0,0,0,.27-.96A1.722,1.722,0,0,0,6.25,4.3,2.482,2.482,0,0,0,4.5,3.72Zm0,.67a1.724,1.724,0,0,1,1.19.39,1.125,1.125,0,0,1,.37.86,1.2,1.2,0,0,1-.33.88,1.715,1.715,0,0,1-1.23.4,1.682,1.682,0,0,1-1.23-.4,1.2,1.2,0,0,1-.33-.88,1.092,1.092,0,0,1,.37-.86A1.69,1.69,0,0,1,4.5,4.39Zm0,3.17a1.928,1.928,0,0,1,1.34.43,1.364,1.364,0,0,1,.43,1.04,1.335,1.335,0,0,1-.43,1.02,1.957,1.957,0,0,1-1.34.42,1.942,1.942,0,0,1-1.33-.41,1.3,1.3,0,0,1-.44-1.03,1.3,1.3,0,0,1,.44-1.04A1.868,1.868,0,0,1,4.5,7.56Z" transform="translate(-1.92 -3.72)"/></svg></div>',
      nine: '<div class="big_pic nine"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4.99 7.42"><path d="M4.41,3.72a2.291,2.291,0,0,0-1.73.7A2.358,2.358,0,0,0,2,6.17a2.331,2.331,0,0,0,.61,1.68,2.163,2.163,0,0,0,1.66.68,2.04,2.04,0,0,0,1.1-.3,2.086,2.086,0,0,0,.76-.85h.03v.3A3.879,3.879,0,0,1,5.7,9.65a1.46,1.46,0,0,1-1.29.8A1.352,1.352,0,0,1,2.93,9.23H2.12A2.048,2.048,0,0,0,4.4,11.14a2.206,2.206,0,0,0,1.92-1.12,5.247,5.247,0,0,0,.67-2.78,4.442,4.442,0,0,0-.63-2.56A2.213,2.213,0,0,0,4.41,3.72Zm.01.69a1.543,1.543,0,0,1,1.19.51,1.765,1.765,0,0,1,.44,1.23,1.691,1.691,0,0,1-.47,1.22,1.592,1.592,0,0,1-1.17.48,1.492,1.492,0,0,1-1.16-.47,1.64,1.64,0,0,1-.44-1.21A1.8,1.8,0,0,1,3.25,4.9,1.5,1.5,0,0,1,4.42,4.41Z" transform="translate(-2 -3.72)"/></svg></div>',
      ten: '<div class="big_pic ten"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7.27 7.42"><path d="M1.96,3.86A3.4,3.4,0,0,1,.55,4.91v.82a3.674,3.674,0,0,0,1.23-.86V11h.76V3.86Zm3.73-.14A1.771,1.771,0,0,0,3.97,4.93a6.3,6.3,0,0,0-.4,2.5,6.4,6.4,0,0,0,.4,2.5,1.827,1.827,0,0,0,3.44,0,6.385,6.385,0,0,0,.41-2.5,6.283,6.283,0,0,0-.41-2.5A1.789,1.789,0,0,0,5.69,3.72Zm0,.71a1.085,1.085,0,0,1,1.03.77,5.9,5.9,0,0,1,.32,2.23,6.011,6.011,0,0,1-.32,2.23,1.081,1.081,0,0,1-2.07,0,6.046,6.046,0,0,1-.31-2.23A5.94,5.94,0,0,1,4.65,5.2,1.079,1.079,0,0,1,5.69,4.43Z" transform="translate(-0.55 -3.72)"/></svg></div>'
    }
    this.emptyCard = '<div class="body"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 89"><defs><pattern id="img1" patternUnits="userSpaceOnUse" width="9.752" height="9.8"><path d="M5.035,3.072A3.174,3.174,0,0,1,7.81,4.331a2.881,2.881,0,0,1,.355,1.258v.46A2.058,2.058,0,0,1,7.544,7.46l.04.613v.04a1.441,1.441,0,0,1-.153.653h.032q.984-.411.984-.807.274-.371.492-.371h.048q.387,0,.387.807.436.347.436.573v.153a.572.572,0,0,1-.548.3l-.548-.048a16.463,16.463,0,0,0-1.9.976v.121l1.436.653.427-.081q.589.113.589.4,0,.25-.468.653,0,.774-.4.774H8.358q-.315,0-.742-.774l-1.161-.6a1.755,1.755,0,0,1-1.524.645,1.7,1.7,0,0,1-1.516-.645q-1.291.645-1.291.807-.307.573-.581.573H1.454q-.339,0-.339-.734A1.172,1.172,0,0,1,.647,11.4q0-.282.548-.363l.468.081,1.4-.653v-.121L1.2,9.372.526,9.42q-.419,0-.468-.363V8.968q0-.177.436-.613.024-.734.266-.734h.2q.29,0,.661.734l.815.411v-.04l-.153-.573.073-.6A3.131,3.131,0,0,1,1.7,5.4,2.627,2.627,0,0,1,3.535,3.258,5.343,5.343,0,0,1,5.035,3.072ZM1.97,5.637A3.135,3.135,0,0,0,2.4,7.178h.04V6.653a4.966,4.966,0,0,1-.186-1.1q.065-.331.145-.331h.081l.113.121-.081.29.2.936v.444l-.121,1.1v.081q0,.613.944.815a.97.97,0,0,1,.419.653v.161l.621.081h.548l.782-.169q0-.613,1.2-1.049a1.094,1.094,0,0,0,.2-.726L7.148,6.734l.21-1.024V5.589l-.081-.274.186-.137a.3.3,0,0,1,.153.3V5.8L7.431,6.936l.032.161A1.787,1.787,0,0,0,7.9,5.96V5.678A2.155,2.155,0,0,0,6.527,3.637a4.519,4.519,0,0,0-1.476-.274H4.817A2.63,2.63,0,0,0,2.091,4.944,2.355,2.355,0,0,0,1.97,5.637ZM4.237,6.694q.347.1.266.573-.355,1.049-.936,1.016-.476,0-.694-1.016Q2.874,6.694,4.237,6.694Zm1.476,0q1.25.065,1.282.6-.226.992-.815.992-.4,0-.815-1.016Q5.35,6.71,5.713,6.694Zm1.1,3.251h.032a14.229,14.229,0,0,1,1.871-.855l.629.032q.194-.048.194-.113a1.388,1.388,0,0,1-.427-.726q-.048-.419-.169-.419-.169.065-.492.734a5.406,5.406,0,0,0-1.524.863ZM.833,7.92q-.1.726-.186.726-.323.242-.323.411l.282.065L1.2,9.089a16.2,16.2,0,0,1,1.863.9V9.9a.75.75,0,0,0-.621-.782Q1.2,8.581,1.2,8.154A.436.436,0,0,0,.833,7.92Zm3.976.089.081.04v1.04l-.315.331q-.234-.081-.234-.452A1.019,1.019,0,0,1,4.809,8.009Zm.29-.024a1.3,1.3,0,0,1,.427,1.073.322.322,0,0,1-.25.363l-.3-.331V8.033ZM3.333,10.509a1.487,1.487,0,0,0,1.6,1.307,1.587,1.587,0,0,0,1.6-1.347A4.1,4.1,0,0,1,6.689,9.21,3.37,3.37,0,0,0,6.3,10.6a1.569,1.569,0,0,1-1.178.484H4.777q-1.17-.145-1.242-.734A2.923,2.923,0,0,0,3.212,9.21,4.062,4.062,0,0,1,3.333,10.509Zm.113-1.137a5.213,5.213,0,0,1,.274,1.137h.04V9.9A.628.628,0,0,0,3.446,9.372ZM6.108,9.9v.6q.089,0,.113-.516l.153-.573q-.081,0-.226.436Zm-2.186.04v.29l.113.032v-.29Zm1.9,0v.323l.161-.065V9.9Zm-1.67.048v.323l.153.032v-.315Zm1.4.04v.315l.169-.048-.016-.307Zm-.282,0v.4l.145-.016L5.4,10.033Zm-.581.032v.363H4.89v-.363Zm.315,0v.363h.153v-.363Zm-.855.4V10.8l.153.032v-.323Zm.855.129v.323h.153v-.363Zm-.315,0v.323H4.89V10.6ZM1.7,11.4,1,11.372l-.04.032v.129a1,1,0,0,1,.419.686q.04.363.121.363.121,0,.548-.678a7.364,7.364,0,0,0,1.161-.7,1.047,1.047,0,0,1-.113-.436A5,5,0,0,1,1.7,11.4Zm5.057-.6-.1.452q1.4.678,1.4.968,0,.1.307.363.129,0,.2-.678l.379-.411q-.032-.121-.226-.121l-.581.032Zm-2.347-.734-.024.323.186.04v-.363Zm.008.484v.323l.153.04V10.59Zm-.54-.169v.315l.153.048v-.331Zm1.412.194V10.9l.161-.04v-.331Zm.258-.065v.323L5.7,10.8v-.331Zm.274-.1v.331l.161-.048v-.323Z" transform="translate(-0.059 -3.072)"/></pattern></defs><rect rx="4"/><rect rx="4" class="pattern"/></svg></div>'
    this.initElement()
  }
  initElement() {
    this.element = document.createElement('div')
    this.element.className = 'card'
    if (this.model) {
      this.element.innerHTML = '<div class="body"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 89"><rect rx="4"/></svg></div>'
      this.element.className += ` ${this.model.suit} ${this.model.value} ${this.getColor(this.model.suit)}`
      this.element.innerHTML += `<div class="suit top">${this.getSuit(this.model.suit)}</div><div class="suit bottom">${this.getSuit(this.model.suit)}</div>`
      this.element.innerHTML += `<div class="value top">${this.getValue(this.model.value)}</div><div class="value bottom">${this.getValue(this.model.value)}</div>`
      this.element.innerHTML += `<div class="middle">${this.getBigValue(this.model.value)}</div>`
    } else {
      this.element.classList.add('back')
      this.element.innerHTML = this.emptyCard
    }
  }
  getElement() {
    return this.element
  }
  getColor (suit) {
    return this.colors[suit]
  }
  getSuit (suit) {
    return this.suits[suit]
  }
  getValue (value) {
    return this.values[value]
  }
  getBigValue (value) {
    return this.bigValues[value]
  }
  removeElement() {
    this.element.parentNode.removeChild(this.element)
    this.element = null
  }
  destroy() {
    this.element = null
  }
}
class GameBoardView {
  constructor() {
    this.compactCount = 8
    this.myContainer = document.querySelector('.board .me')
    this.opponentContainer = document.querySelector('.board .opponent')
    this.trumpContainer = document.querySelector('.board .trump')
    this.gameContainer = document.querySelector('.board .game')
    this.takeBtn = document.querySelector('.take')
    this.doneBtn = document.querySelector('.done')
    this.addEventListeners()
  }
  addEventListeners() {
    this.updateEventListeners(true)
  }
  removeEventListeners() {
    this.removeEventListeners(false)
  }
  updateEventListeners (add) {
    asafonov.messageBus[add ? 'subscribe' : 'unsubscribe'](asafonov.events.MY_UPDATED, this, 'onMyUpdated')
    asafonov.messageBus[add ? 'subscribe' : 'unsubscribe'](asafonov.events.OPPONENT_UPDATED, this, 'onOpponentUpdated')
    asafonov.messageBus[add ? 'subscribe' : 'unsubscribe'](asafonov.events.TRUMP_UPDATED, this, 'onTrumpUpdated')
    asafonov.messageBus[add ? 'subscribe' : 'unsubscribe'](asafonov.events.GAME_UPDATED, this, 'onGameUpdated')
    asafonov.messageBus[add ? 'subscribe' : 'unsubscribe'](asafonov.events.TAKE_BTN_UPDATE, this, 'onTakeBtnUpdate')
    asafonov.messageBus[add ? 'subscribe' : 'unsubscribe'](asafonov.events.DONE_BTN_UPDATE, this, 'onDoneBtnUpdate')
    asafonov.messageBus[add ? 'subscribe' : 'unsubscribe'](asafonov.events.GAME_OVER, this, 'onGameOver')
    this.takeBtn[add ? 'addEventListener' : 'removeEventListener']('click', () => this.onTakeBtnClick())
    this.doneBtn[add ? 'addEventListener' : 'removeEventListener']('click', () => this.onDoneBtnClick())
  }
  onMyCardClick (index) {
    asafonov.messageBus.send(asafonov.events.CARD_CLICKED, index)
  }
  onTakeBtnClick() {
    asafonov.messageBus.send(asafonov.events.BTN_CLICKED, {type: 'take'})
  }
  onDoneBtnClick() {
    asafonov.messageBus.send(asafonov.events.BTN_CLICKED, {type: 'done'})
  }
  onMyUpdated (list) {
    this.myContainer.innerHTML = ''
    this.myContainer.classList[list.length > this.compactCount ? 'add' : 'remove']('compact')
    for (let i = 0; i < list.length; ++i) {
      const cardView = new CardView(list[i])
      const div = cardView.getElement()
      div.addEventListener('click', () => this.onMyCardClick(i))
      this.myContainer.appendChild(div)
      cardView.destroy()
    }
  }
  onOpponentUpdated (list) {
    this.opponentContainer.innerHTML = ''
    this.opponentContainer.classList[list.length > this.compactCount ? 'add' : 'remove']('compact')
    for (let i = 0; i < list.length; ++i) {
      const cardView = new CardView()
      this.opponentContainer.appendChild(cardView.getElement())
      cardView.destroy()
    }
  }
  onGameUpdated (list) {
    this.gameContainer.innerHTML = ''
    this.gameContainer.classList[list.length > this.compactCount ? 'add' : 'remove']('compact')
    for (let i = 0; i < list.length; ++i) {
      const cardView = new CardView(list[i])
      this.gameContainer.appendChild(cardView.getElement())
      cardView.destroy()
    }
  }
  onTrumpUpdated (card) {
    this.trumpContainer.innerHTML = ''
    if (card) {
      const cardView = new CardView(card)
      this.trumpContainer.appendChild(cardView.getElement())
      cardView.destroy()
    }
  }
  onTakeBtnUpdate (visible) {
    this.takeBtn.style.display = visible ? 'block' : 'none'
  }
  onDoneBtnUpdate (visible) {
    this.doneBtn.style.display = visible ? 'block' : 'none'
  }
  onGameOver (isWon) {
    if (isWon) {
      alert('Congratulations! You won!')
    } else {
      alert('You lose. Maybe next time?')
    }
    location.reload()
  }
  destroy() {
    this.removeEventListeners()
  }
}
class UpdaterView {
  constructor (upstreamVersionUrl, updateUrl) {
    this.model = new Updater(upstreamVersionUrl)
    this.updateUrl = updateUrl
  }
  showUpdateDialogIfNeeded() {
    this.model.isUpdateNeeded()
      .then(isUpdateNeeded => {
        if (isUpdateNeeded) this.showUpdateDialog()
      })
  }
  showUpdateDialog() {
    if (confirm('New version available. Do you want to update the App?')) location.href = this.model.getUpdateUrl(this.updateUrl)
  }
}
window.asafonov = {}
window.asafonov.version = '0.1'
window.asafonov.messageBus = new MessageBus()
window.asafonov.events = {
  MY_UPDATED: 'myUpdated',
  OPPONENT_UPDATED: 'opponentUpdated',
  TRUMP_UPDATED: 'trumpUpdated',
  GAME_UPDATED: 'gameUpdated',
  CARD_CLICKED: 'cardClicked',
  TAKE_BTN_UPDATE: 'takeBtnUpdate',
  DONE_BTN_UPDATE: 'doneBtnUpdate',
  BTN_CLICKED: 'btnClicked',
  GAME_OVER: 'gameOver'
}
window.asafonov.settings = {
}
window.onerror = (msg, url, line) => {
  alert(`${msg} on line ${line}`)
}
document.addEventListener("DOMContentLoaded", function (event) {
  window.asafonov.deck = new Deck()
  const board = new GameBoardView()
  const c = new DurakController(window.asafonov.deck)
})
