/**
 * @jsx React.DOM
 */

var App = React.createClass({displayName: 'App',
	getInitialState: function() {
		return {
			selectedBoard: null
			, authorized: Trello.authorized()
		}
	}
	, componentDidMount: function() {
		var router = Router({
			'/': function() {
				this.setState({selectedBoard: null})
			}.bind(this)
			, '/board/:id': function(id) { 
				this.loadBoard(id, function(board) {this.setState({selectedBoard: board})}.bind(this))
			}.bind(this)
		})
		router.init("/")
	}
	, authorized: function() {
		this.setState({authorized: true})
	}
	, loadBoard: function (id, callback) {
		Trello.get("/boards/"+id,{cards:"open",lists:"open",checklists:"all",members:"all",actions:"all"},function(board) {
			_.each(board.cards,function(card){
				card.actions = _.filter(board.actions, function(action) {
			      return action.type == "commentCard" && action.data.card && card.id == action.data.card.id
			    })
			})
			callback(board)
		})
	}
	, render: function() {
		var selectedBoard = this.state.selectedBoard
		var authorized = this.state.authorized

		var view = null
		if (!authorized) {
			view = TrelloAuthorization( {onSuccess:this.authorized} )
		} else if (selectedBoard) {
			view = Board( {board:selectedBoard} )
		} else {
			view = Organizations(null )
		}
		return React.DOM.div(null, 
			AppHeader( {selectedBoard:this.state.selectedBoard} ),
			React.DOM.div( {id:"view", className:"container"}, 
				view
			)			
		)
	}
})

var AppHeader = React.createClass({displayName: 'AppHeader',
	render: function() {
		var selectedBoard = this.props.selectedBoard

		return React.DOM.nav( {className:"navbar navbar-default", role:"navigation"}, 
			React.DOM.div( {className:"navbar-header"}, 
				React.DOM.button( {type:"button", className:"navbar-toggle", 'data-toggle':"collapse", 'data-target':"#app-navbar-collapse-1"}, 
				  React.DOM.span( {className:"sr-only"}, "Toggle navigation"),
				  React.DOM.span( {className:"icon-bar"}),
				  React.DOM.span( {className:"icon-bar"}),
				  React.DOM.span( {className:"icon-bar"})
				),
				React.DOM.p( {className:"navbar-text " }, "Trello Viewer")
			),
			React.DOM.div( {className:"collapse navbar-collapse", id:"app-navbar-collapse-1"}, 
				React.DOM.ul( {className:"nav navbar-nav navbar-center"}, 
				  React.DOM.li(null, React.DOM.p( {className:"navbar-text"}, selectedBoard ? selectedBoard.name : React.DOM.span(null, React.DOM.span( {className:"glyphicon glyphicon-arrow-down"}), " Please select a board ", React.DOM.span( {className:"glyphicon glyphicon-arrow-down"}))))
				)
			)
		)
	}
})

var TrelloAuthorization = React.createClass({displayName: 'TrelloAuthorization',
	componentDidMount: function() {
		var successCallback = function() {
			this.props.onSuccess()
		}.bind(this)

		var options = {name: "Trello Viewer", scope: {write: false}, interactive: false}
		Trello.authorize(options)

		if (!Trello.authorized()) {
			options.interactive = true
			Trello.authorize(options, successCallback)
		} else {
			successCallback()
		}
	}, render: function() {
		return React.DOM.div( {className:"alert alert-info"}, "Requesting authorization from Trello") 
	}
})

var Markdown = function() {
	var converter = new Showdown.converter()

	return React.createClass({
		render: function() {
			var text = this.props.text
			return React.DOM.div( {dangerouslySetInnerHTML:{__html: converter.makeHtml(text)}} )
		}
	})
}()

var Format = React.createClass({displayName: 'Format',
	render: function() {
		if (this.props.date) {
			return React.DOM.span(null, this.formatDate(this.props.date))
		} else {
			return React.DOM.span( {className:"error"}, "UnknownFormat")
		}
	}
	, formatDate: function(date) {
		if (date == "now") {
			date = new Date()
		} else if (date == "" || !date) {
			return "None"
		} else {
			date = new Date(date)
		}
		return date.getFullYear()+"-"+(date.getMonth()+1)+"-"+date.getDate()+" "+date.getHours()+":"+date.getMinutes()
	}
})

var OrganizationBoards = React.createClass({displayName: 'OrganizationBoards',
	render: function() {
		var organization = this.props.organization
		var boards = this.props.boards

		return React.DOM.div( {className:"panel panel-default"}, 
			React.DOM.div( {className:"panel-heading"}, React.DOM.h2( {className:"panel-title"}, organization.displayName)),
			React.DOM.ul( {className:"list-group"}, 
				boards.map(function(board) {
					return React.DOM.li( {key:board.id, className:"list-group-item"}, React.DOM.a( {href:"#/board/"+board.id}, board.name))
				})
			)
		)
	}
})

var Organizations = React.createClass({displayName: 'Organizations',
	getInitialState: function() {
		Trello.get('/members/me', {boards: "open", organizations: "all"}, function(me) {
			var boards = _.groupBy(me.boards, function(board) { return board.idOrganization || ""})
			var organizations = me.organizations
			organizations.unshift({id: "", displayName:"Personal"})

			this.setState({organizations: organizations, boards: boards})
		}.bind(this))
		return {organizations: [], boards: {}}
	}, render: function() {
		var organizations = this.state.organizations
		var boards = this.state.boards

		return React.DOM.div( {className:"row"}, 
			organizations.map(function(organization) {
				return (React.DOM.div( {key:organization.displayName, className:"col-md-6"}, 
					OrganizationBoards( {organization:organization, boards:boards[organization.id]})
				))
			})
		)
	}
})

var Card = React.createClass({displayName: 'Card',
	render: function() {
		var card = this.props.card
		var self = this

		return React.DOM.div( {className:"panel panel-info"}, 
			React.DOM.div( {className:"panel-heading"}, React.DOM.h3( {className:"panel-title"}, card.name)),
			card.desc == "" ? "" : React.DOM.div( {className:"panel-body"}, Markdown( {text:card.desc} )),
			card.actions.length > 0 ? 
				React.DOM.ul( {className:"list-group"}, 
					card.actions.map(function(action) {
						return React.DOM.li( {key:action.id, className:"list-group-item"}, action.memberCreator.fullName, " (",Format( {date:action.date} ),") : ", Markdown( {text:action.data.text} ))
					})
				)
				: ""
			
		)
	}
})

var List = React.createClass({displayName: 'List',
	render: function() {
		var list = this.props.list
		var cards = this.props.cards || []

		return   React.DOM.div( {className:"panel panel-primary"}, 
			React.DOM.div( {className:"panel-heading"}, React.DOM.h2( {className:"panel-title"}, list.name, React.DOM.span( {className:"badge pull-right"}, list.size))),
    		React.DOM.div( {className:"panel-body"}, 
    			cards.map(function(card) {
    				return Card( {key:card.id, card:card} )
    			})
    		)
    	)
	}
})

var Board = React.createClass({displayName: 'Board',
	render: function() {
		var board = this.props.board
		var cards = _.groupBy(board.cards, function(card) { return card.idList })
		return React.DOM.div(null, 
			board.lists.map(function(list){ return List( {key:list.id, list:list, cards:cards[list.id]} )})
		)
	}
})
