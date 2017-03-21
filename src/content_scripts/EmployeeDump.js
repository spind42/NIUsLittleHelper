$(document).ready(function() {


  var exportTable = $(".export");

//#ctl00_main_m_Panel > table > tbody > tr:nth-child(2) > td > table
  //exportTable.hide();

  var header = $("#ctl00_m_Header");

  var clicked = {};

  /*
    lade das Menü, mit den möglichen Berechnungen
    es wäre unklug gleich alle Berechnungen zu machen -> zu viele
    Requests und nicht jeder MA braucht alle Berechnungen
    TODO:
  */
  var path = chrome.extension.getURL("src/webcontent/employee_dump_menu.html");
  console.log("path: " + path);
  $.get(path, function(data) {

    header.after(data);
    //data.menu();
    $("#menu").menu();


    $("#rddienste").click(function() {
      console.log("rddienste gecklickt!");
      if ("rddienste" in clicked) {
        return;
      }
      clicked["rddienste"] = true;


      exportTable.find("tr:gt(0)").append("<td class='rddienste'>Berechnen...</td>");
      exportTable.find("tr:first").append("<th>Dienste d. l. 6 Monate</th>");

      exportTable.find("tr:gt(0)").each(function(index, element) {
          var dnr = $(element).find("td:first").text();


            dnrToIdentifier(dnr).then(
            function(result) {
            console.log("dnrToIdentifier result: " + result);

            calculateStatistic(result, "dienste").then(
            function(statresult) {
            $(element).find(".rddienste").text(statresult);
            },
            function() {
            console.log("calculateStatistic --> error");
            $(element).find(".rddienste").text("statcalc error");
            });
            },
            function() {
            console.log("error");
            $(element).find(".rddienste").text("dnrToIdentifier error");
            });



      });

    });

    $("#rddienste").trigger("click");


    $("#sandienststunden").click(function() {
      console.log("sandienststunden gecklickt");
      if ("sandienststunden" in clicked) {
        return;
      }
      clicked["sandienststunden"] = true;

      exportTable.find("tr:gt(0)").append("<td class='dienststunden'>Berechnen...</td>");
      exportTable.find("tr:first").append("<th>Dienststunden d. l. 6 Monate</th>");

         exportTable.find("tr:gt(0)").each(function(index, element) {
          var dnr = $(element).find("td:first").text();

            dnrToIdentifier(dnr).then(
            function(result) {
            console.log("dnrToIdentifier result: " + result);

            calculateStatistic(result, "stunden").then(
            function(statresult) {
            $(element).find(".dienststunden").text(statresult);
            },
            function() {
            console.log("calculateStatistic --> error");
            $(element).find(".dienststunden").text("statcalc error");
            });
            },
            function() {
            console.log("error");
            $(element).find(".dienststunden").text("dnrToIdentifier error");
            });


      });


    });
  });

});
