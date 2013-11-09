/**
 * @jsx React.DOM
 */

var App = React.createClass({
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
			view = <TrelloAuthorization onSuccess={this.authorized} />
		} else if (selectedBoard) {
			view = <Board board={selectedBoard} />
		} else {
			view = <Organizations />
		}
		return <div>
			<AppHeader selectedBoard={this.state.selectedBoard} />
			<div id="view" className="container">
				{view}
			</div>			
		</div>
	}
})

var AppHeader = React.createClass({
	render: function() {
		var selectedBoard = this.props.selectedBoard

		return <nav className="navbar navbar-default" role="navigation">
			<div className="navbar-header">
				<button type="button" className="navbar-toggle" data-toggle="collapse" data-target="#app-navbar-collapse-1">
				  <span className="sr-only">Toggle navigation</span>
				  <span className="icon-bar"></span>
				  <span className="icon-bar"></span>
				  <span className="icon-bar"></span>
				</button>
				<p className="navbar-text ">Trello Viewer</p>
			</div>
			<div className="collapse navbar-collapse" id="app-navbar-collapse-1">
				<ul className="nav navbar-nav navbar-center">
				  <li><p className="navbar-text">{selectedBoard ? selectedBoard.name : <span><span className="glyphicon glyphicon-arrow-down"></span> Please select a board <span className="glyphicon glyphicon-arrow-down"></span></span>}</p></li>
				</ul>
			</div>
		</nav>
	}
})

var TrelloAuthorization = React.createClass({
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
		return <div className="alert alert-info">Requesting authorization from Trello</div> 
	}
})

var Markdown = function() {
	var converter = new Showdown.converter()

	return React.createClass({
		render: function() {
			var text = this.props.text
			return <div dangerouslySetInnerHTML={{__html: converter.makeHtml(text)}} />
		}
	})
}()

var Format = React.createClass({
	render: function() {
		if (this.props.date) {
			return <span>{this.formatDate(this.props.date)}</span>
		} else {
			return <span className="error">UnknownFormat</span>
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

var OrganizationBoards = React.createClass({
	render: function() {
		var organization = this.props.organization
		var boards = this.props.boards

		return <div className="panel panel-default">
			<div className="panel-heading"><h2 className="panel-title">{organization.displayName}</h2></div>
			<ul className="list-group">
				{boards.map(function(board) {
					return <li key={board.id} className="list-group-item"><a href={"#/board/"+board.id}>{board.name}</a></li>
				})}
			</ul>
		</div>
	}
})

var Organizations = React.createClass({
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

		return <div className="row">
			{organizations.map(function(organization) {
				return (<div key={organization.displayName} className="col-md-6">
					<OrganizationBoards organization={organization} boards={boards[organization.id]}/>
				</div>)
			})}
		</div>
	}
})

var Card = React.createClass({
	render: function() {
		var card = this.props.card
		var self = this

		return <div className="panel panel-info">
			<div className="panel-heading"><h3 className="panel-title">{card.name}</h3></div>
			{card.desc == "" ? "" : <div className="panel-body"><Markdown text={card.desc} /></div>}
			{card.actions.length > 0 ? 
				<ul className="list-group">
					{card.actions.map(function(action) {
						return <li key={action.id} className="list-group-item">{action.memberCreator.fullName} (<Format date={action.date} />) : <Markdown text={action.data.text} /></li>
					})}
				</ul>
				: ""
			}
		</div>
	}
})

var List = React.createClass({
	render: function() {
		var list = this.props.list
		var cards = this.props.cards || []

		return   <div className="panel panel-primary">
			<div className="panel-heading"><h2 className="panel-title">{list.name} <span className="badge pull-right">{list.size}</span></h2></div>
    		<div className="panel-body">
    			{cards.map(function(card) {
    				return <Card key={card.id} card={card} />
    			})}
    		</div>
    	</div>
	}
})

var Board = React.createClass({
	render: function() {
		var board = this.props.board
		var cards = _.groupBy(board.cards, function(card) { return card.idList })
		return <div>
			{board.lists.map(function(list){ return <List key={list.id} list={list} cards={cards[list.id]} />})}
		</div>
	}
})
