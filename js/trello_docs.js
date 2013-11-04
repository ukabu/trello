// Okay I admit the code is ugly...
if (typeof console === "undefined" || typeof console.log === "undefined") { //Fix IE window.console bug
 console = {};
 console.log = function() {};
}

savedOptions = false;

$(document).ready(function(){
	var defaultOptions = {
        scope: {
            write: false
        },
        success: initDoc
    };
	if(typeof Trello==="undefined") {
		$("#view").html("<h1>Connection to Trello API is broken, Please <a href='javascript:window.reload();'>Reload</a></h1>");
	}

	Trello.authorize(_.extend({}, defaultOptions, {// Authentication
        interactive: false
    }));

    if (!Trello.authorized()) {
        return Trello.authorize(defaultOptions);
    }
    
	$(window).bind("hashchange",router);
});

var initDoc=function () {
	if (!Trello.authorized()) return Trello.authorize(defaultOptions);
	Trello.get('/members/me',{boards:"open",organizations:"all"}, function(me) {
		window.myself=me;
		router();
	},function(xhr){
		if (xhr.status == 401) {
			Trello.deauthorize();
			Trello.authorize(defaultOptions);
		} else {
			$("#view").html("<h1>Connection to Trello API is broken, Please <a href='javascript:reload();'>Reload</a></h1>");
		}
	});
};

var router=function(){
	var hash=location.hash.replace("#","");
	if (hash!=="")
	{
    var hashArray = hash.split("!");
    var boardId = hashArray[0]
    myself.selectedBoard = _.find(myself.boards, function(board) { return board.id == boardId })
    
	  getBoard(boardId, _.chain((hashArray[1] || "members=all&lists=all&labels=all&columns=all").split("&")).map(function(option){
      option = option.split("=");
      option[1] = option[1].split(",");
      return option;
    }).object().value());
	} else {
    myself.selectedBoard = null
    if(window.myself){
			listBoards();
		}else{
			initDoc();
		}
	}
  $("#selected-board").html(Mustache.render($("#selected-board-template").html(), myself))
};

var listBoards=function(){
	if(!myself.orgBoards) { // Not initiated yet
		var categories=_.groupBy(myself.boards,function(board){ // Categories Boards
			var id=board.idOrganization?board.idOrganization:"";
			return id;
		});
		var orgList=_.groupBy(myself.organizations,function(org){ // Map orgId-orgName
			return org.id;
		});

		myself.orgBoards=_.map(categories,function(value,key){ // Create Array of Organizations containing Array of Boards
			var list={};
			list.boards=value;
			if(key===""||key===null){
				list.name="Personal";
			}else if(!orgList.hasOwnProperty(key)){
				list.name="External Organization";
			}else{
				list.name=orgList[key][0].displayName
			}
			return list;
		});
	}

	$("#view").empty();
  var boardMenuTemplate = $("#board-menu-template").html()
  $("#view").html(Mustache.render(boardMenuTemplate, myself))
};

var listOptions=function(board){
  $("#view").empty();
  $("#view").html("<h1>Loading ...</h1>");
  Trello.get("/boards/"+board,{cards:"open",lists:"open",checklists:"all",members:"all",actions:"all"},function(board){
    $("#view").html("<h1>Loading ...OK!!</h1>");
    window.doc=board; //debug
    window.title=board.name + " Options";
    var columns=["Name","Description","Due Date","Checklists","Members","Labels","Votes"];
    board.labels = _.map(board.labelNames, function(label, color){
      return {name: label || "Unnamed", color: color};
    });
    board.labels.push({name:"Unlabeled", color: "white"});
    console.log(board.labels);
    board.displayColumns = _.map(columns, function(column){
      return {name: column};
    });
    var template = "<h1>"+title+"</h1><div id='options'><div id='lists'><b>Lists: </b>{{#lists}}<span class='off checkItem' id='{{id}}'>{{name}}</span>{{/lists}}</div><div id='labels'><b>Labels: </b>{{#labels}}<span class='off checkItem {{color}}' id='{{color}}'>{{name}}</span>{{/labels}}</div><div id='columns'><b>Columns: </b>{{#displayColumns}}<span class='off checkItem' id='{{name}}'>{{name}}</span>{{/displayColumns}}</div><div id='members'><b>Members: </b>{{#members}}<span class='off checkItem' id='{{id}}'>{{fullName}}</span>{{/members}}</div></div><span class='button downloader' id='submitOptions'>Submit Options</span>";
    var str=Mustache.render(template,board);
    $("#view").html(str);
    $("#submitOptions").click(function(){
      var options = {members:"all", lists:"all", labels:"all", columns:"all"};
      _.each($("#options").children(), function(option){
        var ct = $(option).children(".checkItem").length;
        var on = $(option).children(".on");
        if(on.length !== ct && on.length != 0){
          var vals = _.map(on, function(val){
            return $(val).attr("id");
          });
          options[$(option).attr("id")] = vals;
        }
      });
      savedOptions = options;
      var str = _.chain(options).map(function(val, key){
        if(_.isString(val)){
          return key+"="+val;
        }
        return key+"="+val.join(",");
      }).value().join("&");
      window.location.hash = window.location.hash+"!"+str;
    });
    $(".checkItem").click(function(e){
      $(e.target).toggleClass('on off');
    });
    $("#Name").hide();
    if(savedOptions){
      _.each(savedOptions, function(val, option){
        if(val !== "all"){
          _.each(val, function(id){
            $("#"+id).toggleClass('on off');
            console.log(id);
          });
        }
      });
    }
  });
}

var filter=function(board, options){
  board.lists = _.filter(board.lists, function(list){
    return (options.lists[0] === "all"||_.contains(options.lists, list.id));
  });
  board.cards = _.filter(board.cards, function(card){
    if(options.lists[0]==="all"||_.contains(options.lists, card.idList)){
      if(options.labels[0]!=="all"){
        var flag=false;
        if(card.labels.length !== 0 || !_.contains(options.labels, "white")){
          _.each(card.labels, function(label){
            if(_.contains(options.labels, label.color)){
              flag=true;
              return false;
            }
          });
          if(!flag) return false;
        }
      }
      if(options.members[0]!=="all"){
        var flag=false;
        _.each(card.idMembers, function(member){
          if(_.contains(options.members, member)){
            flag=true;
            return false;
          }
        });
        if(!flag) return false;
      }
      return true;
    }
    return false;
  });
  return board;
}

var resizeAlgorithm=function(arr, index){
  if(arr.length > 2){
    var prev = index - 1, next = index + 1;
    if(prev < 0) prev = arr.length - 1;
    if(next > arr.length - 1) next = 0;
    if(arr[next] < arr[prev]){
      arr[next] += arr[index];
    } else {
      arr[prev] += arr[index];
    }
    arr.splice(index, 1);
    return arr;
  }else if(arr.length == 2){
    return [arr[0] + arr[1]];
  }
  return arr;
}

var getBoard=function(board, options){
  console.log(options);
  $("#view").empty();
  $("#view").html("<h1>Loading ...</h1>");
  Trello.get("/boards/"+board,{cards:"open",lists:"open",checklists:"all",members:"all",actions:"all"},function(board){
	$("#view").html("<h1>Loading ...OK!!</h1>");
	window.doc=board; //debug
	window.title=board.name;
  board = filter(board, options);
	_.each(board.cards,function(card){ //iterate on cards
    card.description = card.desc == "" ? [] : [card.desc]  // this way we can skip rendering block when desc is empty
		_.each(card.idChecklists,function(listId){ //iterate on checklists
			var list=_.find(board.checklists,function(check){ //Find list
				return check.id==listId;
				});
			if(!list){
				console.log("ERROR:"+listId+" not found");
				return;
			}
			list.doneNumber=0;
			list.totalNumber=list.checkItems.length || 0;
			_.each(list.checkItems,function(item){ //Check complete
				item.complete=_.find(card.checkItemStates, function(state){
					if (state.idCheckItem==item.id&&state.state=="complete")
					{
						list.doneNumber++;
						return true;
					}
					return false;
				});
			});
			list.done=(list.doneNumber==list.totalNumber);
			var template="<div class='checklists'><b>{{name}}</b> <span class='show right {{#done}}green{{/done}}'>{{doneNumber}}/{{totalNumber}}</span></div><ul class='checklists'>{{#checkItems}}<li>{{#complete}}<del>{{/complete}}{{name}}{{#complete}}</del>{{/complete}}</li>{{/checkItems}}</ul>";
			var str=Mustache.render(template,list);

			card.checklist=card.checklist||[]; //Make array
			card.checklist.push(str);
		});//iterate on checklists

		card.members=_.map(card.idMembers,function(id){ // iterate on members
			var member=_.find(board.members, function(m) {
				return m.id==id;
			});
			return member.username;
		});// iterate on members

    card.actions = _.filter(board.actions, function(action) {
      return action.type == "commentCard" && action.data.card && card.id == action.data.card.id
    })
	});//iterate on cards

	// Second Init Cards
	var listofcards=_.groupBy(board.cards, function(card){//group cards by ListID
		return card.idList;
	});
	_.each(board.lists,function(list){//iterate over lists, matching cards
		list.cards=listofcards[list.id];
		list.size=list.cards?list.cards.length:0;
		list.show=(list.size>0);
	});
	console.log(board);

	// Date function
	board.formatDate=function(){
		return function(text){
			var date;
			switch(text){
			case "":
				return "None";
			case "now":
				date=new Date();
				break;
			default:
				date=new Date(text);
			}
			return date.getFullYear()+"-"+(date.getMonth()+1)+"-"+date.getDate()+" "+date.getHours()+":"+date.getMinutes();
		};
	};
	board.formatComments=function(){
    var converter = new Showdown.converter();
    return function(text, render) {
      return converter.makeHtml(render(text))
    }
	};


	//
	// Start Rendering
	var defs=["Name","Description","Due Date","Checklists","Members","Labels","Votes"];
  board.sizeColumns = function(){
    var def={columns:[20, 25, 5, 20, 15, 10, 5]};
    var track = 0;
    if(options.columns[0] !== "all"){
      _.each(defs, function(col, index){
        index = index - track;
        if(!(_.contains(options.columns, col)) && col !== "Name"){
          def.columns = resizeAlgorithm(def.columns, index);
          track ++;
        }
      });
    }
    _.each(def.columns, function(val, index){
      console.log(index);
      $(".lists").find(".td:nth-child("+ (index+1) +")").width(val+"%");
      $(".lists").find(".th:nth-child("+ (index+1) +")").width(val+"%");
    });
  }
  if(options.columns[0] !== "all"){
    board.displayColumns=["Name"].concat(options.columns);
  } else {
    board.displayColumns=defs;
  }
  board.checkColumn = function(){
    return function(text){
      text = text.split(">>");
      if(options.columns[0] === "all" || _.contains(options.columns, text[0])){
        return text[1];
      }
      return "";
    }
  }
	var htmltemplate=$("#board-template").html();
	var csvtemplate="";//TODO

  console.log('rendering',board);
	var str=Mustache.render(htmltemplate,board);
	$("#view").html(str);

	// Download Button
	var download="<!DOCTYPE html><html><head><meta charset='utf-8' /><title>"+board.name+"</title><style>"+$("style").text()+"</style></head><body>"+str+"</body></html>";
//this may work for firefox using application/data
//location.href="data:text/html;charset=utf-8,"+encodeURIComponent(download);
	var button1=$("#download");
	button1.addClass("downloader");
	button1.text("Save HTML");
	button1.click(function(){
		console.log("saving..");
		var bb=new BlobBuilder();
		bb.append(download);
		var filesaver=saveAs(bb.getBlob("text/html;charset=utf-8"),board.name+"_"+board.formatDate()('now')+".html");
	});
		var button2=$("#trello-link");
	button2.addClass("downloader");
	button2.text("Trello");
	button2.click(function(){
		location=board.url;
	});
	var button3=$("#printme");
	button3.addClass("downloader");
	button3.text("Print");
	button3.click(function(){
		print();
	});

  board.sizeColumns();

	//button.click(function(){location.href="data:text/html;charset=utf-8,"+encodeURIComponent(download);});
	});
};
