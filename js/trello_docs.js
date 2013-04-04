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
    if(hashArray[1]){
		  getBoard(hashArray[0], _.chain(hashArray[1].split("&")).map(function(option){
        option = option.split("=");
        option[1] = option[1].split(",");
        return option;
      }).object().value());
    } else {
      listOptions(hashArray[0]);
    }
	}else {
		if(window.myself){
			listBoards();
		}else{
			initDoc();
		}
	}
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
	var intro="<div class='list info-list'><h2>About Trello2HTML</h2><p>This is an web app to export Trello Boards to HTML, our team uses this to record our progress every month. We do not track or record you any way, and Trello access is read-only. You can host this on any static server. Google Chrome is tested and supported, your mileage may vary with other browsers(Firefox has a bug when downloading).</p><ul><a href='#4d5ea62fd76aa1136000000c'><li>Demo using Trello Development</li></a><a href='trello.zip'><li>Download zipped source</li></a><a href='https://trello.com/board/trello2html/4fb10d0e312c2b226f1eb4a0'><li>Feature Requests and Bug Reports</li></a><a href='http://tianshuohu.diandian.com/post/2012-06-08/Trello-Export-as-html'><li>Blog Article (Chinese/English)</li></a></ul></div>";
	var template="<h1>{{fullName}} ({{username}})</h1><div id='boardlist'>"+intro+"{{#orgBoards}}<div class='list'><h2>{{name}}</h2><ul>{{#boards}}<a href='#{{id}}' ><li>{{name}}</li></a>{{/boards}}</ul></div>{{/orgBoards}}</div>";
	var str=Mustache.render(template,myself);
	$("#view").html(str);
	$("#boardlist").masonry({
		itemSelector:'.list'
	});

};

var listOptions=function(board){
  $("#view").empty();
  $("#view").html("<h1>Loading ...</h1>");
  Trello.get("/boards/"+board,{cards:"open",lists:"open",checklists:"all",members:"all"},function(board){
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
  Trello.get("/boards/"+board,{cards:"open",lists:"open",checklists:"all",members:"all"},function(board){
	$("#view").html("<h1>Loading ...OK!!</h1>");
	window.doc=board; //debug
	window.title=board.name;
  board = filter(board, options);
	_.each(board.cards,function(card){ //iterate on cards
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
			return date.getFullYear()+"-"+(date.getMonth()+1)+"-"+date.getDate();
		};
	};
	board.formatComments=function(){
		var converter = new Showdown.converter();
		return converter.makeHtml;
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
      $(".table").find(".td:nth-child("+ (index+1) +")").width(val+"%");
      $(".table").find(".th:nth-child("+ (index+1) +")").width(val+"%");
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
	var htmltemplate="<h1><span id='download'></span><span id='trello-link'></span><span id='printme'></span>{{name}} <span class='right'>{{#formatDate}}now{{/formatDate}}</span></h1>{{#lists}}<div class='table'><div class='caption'><h2>{{name}} <span class='show right'>{{size}}</span></h2></div>{{#show}}<div class='thead'><div class='tr'>{{#displayColumns}}<div class='th'>{{.}}</div>{{/displayColumns}}</div></div>{{/show}}<div class='tbody'>{{#cards}}<div class='tr'><div class='td name'><b>{{name}}</b></div>{{#checkColumn}}Description>><div class='td'><div class='comments'>{{#formatComments}}{{desc}}{{/formatComments}}</div></div>{{/checkColumn}}{{#checkColumn}}Due Date>><div class='td due'>{{#formatDate}}{{due}}{{/formatDate}}</div>{{/checkColumn}}{{#checkColumn}}Checklists>><div class='td checklists'>{{#checklist}}<div>{{{.}}}</div>{{/checklist}}</div>{{/checkColumn}}{{#checkColumn}}Members>><div class='td members'>{{#members}}<div>{{.}}</div>{{/members}}</div>{{/checkColumn}}{{#checkColumn}}Labels>><div class='td labels'>{{#labels}}<div class='show {{color}}'>{{name}}&nbsp;</div>{{/labels}}</div>{{/checkColumn}}{{#checkColumn}}Votes>><div class='td votes'>{{badges.votes}}</div>{{/checkColumn}}</div>{{/cards}}</div></div>{{/lists}}";
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
