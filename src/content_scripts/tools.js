/*
lädt das Kürzel des Mitarbeiters aus dem chrome storage
der Mitarbeiter kann das Kürzel über den Optionen Dialog
des Plugins einstellen
*/
function getKuerzel() {
    console.log("getKuerzel");
    return new Promise(function(resolve, reject) {
        chrome.storage.sync.get(STORAGE_KEY_KUERZEL, function(item) {
            if (STORAGE_KEY_KUERZEL in item) {
                resolve(item[STORAGE_KEY_KUERZEL]);
            } else {
                resolve("");
            }
        });
    });
}

function experimentalActivated() {
  var load = {};
  load[STORAGE_KEY_EXPERIMENTAL] = DEFAULT_EXPERIMENTAL;
  chrome.storage.sync.get(STORAGE_KEY_EXPERIMENTAL, function(item) {
    return item[STORAGE_KEY_EXPERIMENTAL];
  });
}

function funktionaerActivated() {
  var load = {};
  load[STORAGE_KEY_FUNKTIONAERS_FEATURES_ON] = DEFAULT_FUNKTIONAERS_FEATURES_ON;
  return new Promise(function(resolve, reject) {
    chrome.storage.sync.get(STORAGE_KEY_FUNKTIONAERS_FEATURES_ON, function(item) {
      resolve(item[STORAGE_KEY_FUNKTIONAERS_FEATURES_ON]);
    });
  });
}

var isCacheActive = function isCacheActive() {
  console.log("isCacheActive --> called");
  var load = {};
  load[STORAGE_KEY_CACHE_ACTIVE] = DEFAULT_CACHE_ACTIVE;
  return new Promise(function(resolve, reject) {
    chrome.storage.sync.get(STORAGE_KEY_CACHE_ACTIVE, function(item) {
      console.log("isCacheActive --> cache is " + item[STORAGE_KEY_CACHE_ACTIVE]);
      //console.log(!item[STORAGE_KEY_CACHE_ACTIVE]);
      resolve(item[STORAGE_KEY_CACHE_ACTIVE]);
    });
  });
}


/*
  verwandelt eine select input feld
  in ein autocomplete feld, wenn overlay true
  wird das ganze nach dem focus aktiv als overlay angezeigt
  damit soll das frame problem umgangen werden!
*/
function makeEmployeeSearchFieldOverlay(input, overlay) {
    var names = [];
    //datenstruktur für suche erzeugen

    input.find("option").each(function(index, option) {
        var option = $(option);
        names.push(option.text());
        console.log("collecting name " + option.text());
    });

    input.after("<input id='person_autocomplete'></input>");
    $("#person_autocomplete").autocomplete({
        source: names,

    });
    //input.hide(); //zumindest solange keine Lösung für FRAMEPROBLEM!!!


    $("#person_autocomplete").on("autocompleteselect", function(event, ui) {
        console.log("aut " + ui.item.value);

        input.find("option").removeAttr("selected");
        input.find("option:contains(" + ui.item.value + ")").attr("selected", "selected");

    });
    /*
    $("#person_autocomplete").on("autocompleteopen", function(event, ui) {
        console.log("on open");
        $(this).autocomplete('widget').css('z-index', 100);
    });
    */


};

function makeEmployeeSearchField(input) {

    makeEmployeeSearchFieldOverlay(input, false);
    input.hide();

};

//maximale cache zeit in millisekunden
MAX_CACHE_TIME = 1000 * 60 * 60 * 24; //24 Stunden cache zeit
//CACHE_ACTIVE = true;
/**
  stellt verbindung zur pouchdb her
*/
function getDB() {
  var db = new PouchDB(POUCHDB_DB_NAME);
  window.PouchDB = PouchDB;
  return db;
}

function saveToCache(prefix, id, object) {
  console.log("saveToCache --> called");
  var db = getDB();

  var dict = {};
  dict['object'] = object;
  dict['lastchange'] = new Date().getTime();
  dict['_id'] = prefix + id;
  var key = prefix + id;
  return db.get(key)
  .catch(function(error) {
      if (error.name === 'not_found') {
          return dict;
      }
  })
  .then(function(olddoc) {
      if (olddoc.hasOwnProperty('_rev')) {
        dict['_rev'] = olddoc['_rev'];
      }

      return db.put(dict)
        .then(function() {
          console.log("saveToCache --> erfolgreich gespeichert: " + JSON.stringify(dict));
          return object;
      }).catch(function(error) {
          console.log("saveToCache --> fehler beim speichern in pouchdb!: " + dict + " error: " +  error);
          return object; //auch im fehlerfalle
      });
  })

}

function getFromCache(prefix, id, args, callback, classobject) {
  console.log("getFromCache --> lade vom cache: " + prefix + id);
  var db = getDB();
  var key = prefix + id;

  //promise verkettet
  return isCacheActive()
    .then(function(cache) {
      if (!cache) { return Promise.reject("cache ist ausgeschalten!"); }
    })
    .then(function() {
      return db.get(key);
    })
    .then(function(doc){

      console.log("getFromCache --> doc: " + JSON.stringify(doc));
      var now = new Date().getTime();
      if (now - doc.lastchange > MAX_CACHE_TIME) {
        console.log("getFromCache --> fail weil cache ablauf!");
        return Promise.reject("maximale cache zeit " + MAX_CACHE_TIME + "ms abgelaufen!");
      }
      if (classobject === undefined) {
        //console.log("just as it is....");
        return doc.object;
      } else {
        //console.log("parse from json string...: " + doc.object);
        return classobject.fromJson(doc.object);
      }
    })
    .catch(function(reason) {  //promise rejected, jetzt lade von niu!
     console.log("getFromCache --> fail: " + reason);
     return callback(args).then(function(object) {
       console.log("getFromCache --> lade von niu: " + JSON.stringify(object));
       var save = object;
       if (classobject != undefined) {
         save = object.toJson();
       }
       isCacheActive().then(function(active) {
         active && saveToCache(prefix, id, save).then(function() {});
       });

       return object;
    });

     //return saveToCache(prefix, id, promise);
    });
}

function getOwnDNRs()
{
 return getFromCache("ownDnr", "", "", getOwnDNRsNotCached);
}

function getOwnDNRsNotCached()
{
    return $.get("https://niu.wrk.at/Kripo/Header.aspx")
    .then(function(data) {

    var regexp = /\((.*?)\)/g;
    var subStr = $(data).find("#userName").text();
    var foundMatch = regexp.exec(subStr);
    var returnArr = foundMatch[1].split(",");
    console.log(returnArr);
    return returnArr;

    });
}

function writeMemo(MemoObj)
{
    var post = {};

    post["Memodate"] = MemoObj["memodate"];
    post["Erinnerung"] = MemoObj["memoreminder"];
    post["Memotext"] = MemoObj["memotext"];
    post["Memo_neu"] = "Memo+neu";
    post["DNR"] = MemoObj["dnr"]
    post["verfasser"] = MemoObj["dnrself"];
    return $.ajax({
            url: "https://niu.wrk.at/df/memo/memo_Neu.asp",
            data: post,
            type: "POST"
          });

}



/*
 * verwandelt die dienstnummer in die EmployeeId von NIU,
 * damit ist es dann möglich direkt auf die Employee Page zuzugreifen
 */
function dnrToIdentifierNotCached(args) {

    var dnr = args.dnr;
    //verkettete promises:
    return $.get("https://niu.wrk.at/Kripo/external/ControlCenterHead.aspx")

        .then(function(data) {
          //console.log("dnrToIdentifier --> first get request promise data: " + data);
          console.log("dnrToIdentifierNotCached --> parse get request data");
          var jData = $(data);

          var keyPostfix = jData.find("#__KeyPostfix").val();
          var eventvalidation = jData.find("#__EVENTVALIDATION").val(); //jData.find("input[name=__EVENTVALIDATION]").val();

          var post = {};
          post["__KeyPostfix"] = keyPostfix;
          post["__EVENTVALIDATION"] = eventvalidation;
          post["__VIEWSTATE"] = "";
          post["__EVENTARGUMENT"] = "";

          post["m_txtEmployeeNumber"] = dnr;
          post["m_btSend"] = "Anfage Senden";
          return post;
        })
        .then( function(post) {
          return $.ajax({
            url: "https://niu.wrk.at/Kripo/external/ControlCenterHead.aspx",
            data: post,
            type: "POST"
          });

        })
        .then( function(data) {
          console.log("dnrToIdentifierNotCached --> parse post req result");
          //console.log("dnrToIdentifier --> post request mit rcv data: " + data);
          // success: function(data, status) {
          var searchString = $(data).find("#m_lbtStatistik").attr("href"); // EmployeeNumberID
          var searchString2 = $(data).find("#m_lbtEducation").attr("href"); // EmployeeId

          var regexpr = /EmployeeNumberID=(.*)/g;
          var regexpr2 = /EmployeeId=(.*)/g;

          var foundIdentA = regexpr.exec(searchString);
          var foundIdentB = regexpr2.exec(searchString2);

          var dict = {};
          dict["ENID"] = foundIdentA[1];
          dict["EID"] = foundIdentB[1];
          return dict;
        });
}

/*
  dnr to identifier pouchdb cached
*/
function dnrToIdentifier(dnr) {
  return getFromCache("empid_", dnr, { 'dnr' : dnr}, dnrToIdentifierNotCached);
}

function getEmployeeDataSheet(empNID) {
return getFromCache("datasheetv2_", empNID, { 'empNID' : empNID}, getEmployeeDataSheetNotCached);
}

function getEmployeeDataSheetNotCached(args)
{
  var dict = {};
  var empNID = args.empNID;
  
  return $.get("https://niu.wrk.at/Kripo/Employee/detailEmployee.aspx?EmployeeNumberID=" + empNID)

  .then(function(data) {

  dict["Vorname"] = $(data).find("#ctl00_main_m_Employee_m_ccEmployeeMain__firstName").val();
  dict["Nachname"] = $(data).find("#ctl00_main_m_Employee_m_ccEmployeeMain__lastName").val();
  dict["istGast"] = $(data).find("#ctl00_main_m_Employee_m_ccEmployeeMain__type_3").prop("checked");
  dict["Dienstgrad"] = $(data).find("#ctl00_main_m_Employee_m_ccEmployeeMain__rank option:selected").text();
  dict["FotoURL"] = $(data).find("#ctl00_main_m_Employee_m_ccEmployeeMain__picture").attr("src");
  dict["Geburtstag"] = $(data).find("#ctl00_main_m_Employee_m_ccEmployeeExtention__birthday_m_Textbox").val();
  dict["Ersteintritt"] = $(data).find("#ctl00_main_m_Employee_m_ccEmployeeExtention__firstEntry_m_Textbox").val();
  dict["TelNummer"] = $(data).find("#ctl00_main_m_Employee_m_ccPersonContact_m_ccContact0_m_NumberLabel").text();
  dict["Email"] = $(data).find("#ctl00_main_m_Employee_m_ccPersonContact_m_ccContact1_m_NumberLabel").text();
  dict["AmpelCode"] = "";

  $(data).find(".PermissionQualificationIcon").each(function() {
   var amphtml = this.outerHTML;
   if ($(amphtml).find('img').length) { dict["AmpelCode"] += amphtml;}
  });

  return dict;

  });


}

function calculateDutyStatistic(empID, reqtype, reqStartDate, reqEndDate) {
    //return calculateDutyStatisticNonCached({'empID' : empID, 'reqtype' : reqtype, 'reqStartDate' : reqStartDate, 'reqEndDate' : reqEndDate});

    var dutyId = empID; //TODO: reqStart, reqEndDate einbauen!
    return getFromCache("dutyid_", dutyId,
      {'empID' : empID, 'reqtype' : reqtype, 'reqStartDate' : reqStartDate, 'reqEndDate' : reqEndDate},
      calculateDutyStatisticNonCached, DutyCount);
}



/*
Liste an möglichen Statistiken, die berechnet werden können
*/
var DUTY_TYPES = {
  "AMB_SONSTIGE" : {description: "sonstige Ambulanzdienste..."},
  "AMB_ALL" : {description: "alle Dienste auf Ambulanzen egal welche Position"},
  "SEFNFR" : {description : "Alle Dienste als Fahrer auf RKL, RKP, RKS"},
  "NFR1" : {description: "Alle Dienste als NFR1 (NFS) auf RKL, RKP, RKS"},
  "NFR2" : {description: "Alle Dienste als NFR2 auf RKL, RKP, RKS"},
  "SEFKTW" : {description: "Alle Dienste als Fahrer auf einem KTW"},
  "SAN1" : {description: "Alle Dienste als SAN1 auf einem KTW"},
  "SAN2" : {description: "Alle Dienste als SAN2 auf einem KTW"},
  "SUM_NFR" : {description: "Alle Dienste auf NFR", aggregate : ["SEFNFR", "NFR1", "NFR2"]},
  "SUM_KTW" : {description: "Alle Dienste auf KTW", aggregate : ["SEFKTW", "SAN1", "SAN2"]},
  "SUM_RD" : {description: "Alle Dienste im RD als RSiA oder höher am KTW + RTW", aggregate : ["SUM_NFR", "SUM_KTW"]},
  "SUM_SAN" : {description: "Alle Dienste als RSiA oder höher", aggregate: ["SUM_RD", "SUM_SANAMB"]},
  "SUM_SANAMB" : {description: "Alle Dienste als RSiA oder höher auf Ambulanzen", aggregate: ["AMB_RSIA", "AMB_RS", "AMB_NFS"]},
  "AMB_RSIA" : {description: "RS in Ausbildung"},
  "AMB_RS" : {description: "Als RS auf der Ambulanz"},
  "AMB_NFS" : {description: "Als NFS auf der Ambulanz"}
};

/*
Klasse um Dienststatistiken zu berechnen
*/
class DutyCount {

  // create statistical counters
  // var rawWochentag = new Array();
  // var rawDienststellen = new Array();
  // var currentDateString;
  constructor() {
    this.sumDuty = 0; // Gesamtdauer aller Dienste
    this.countDienste = 0;
    // var rawKollegen = new Array();
    // var rawDutyAs = new Array();
    this.hourDutyAs = {};
    this.countDutyAs = {};
  }

  static fromJson(json) {
    var dict = JSON.parse(json);
    var d = new DutyCount();
    d.hourDutyAs = dict.hourDutyAs;
    d.countDutyAs = dict.countDutyAs;
    return d;
  }

  toJson() {
    return JSON.stringify({
      hourDutyAs : this.hourDutyAs,
      countDutyAs : this.countDutyAs
    });
  }

  /*
    fügt die Dienststunden hinzu und erhöht den Dienstzähler um 1,
    für die jeweilige Position
  */
  addHourDutyAs(position, hours) {
      if (position in this.hourDutyAs) {
        this.hourDutyAs[position] += hours;
        this.countDutyAs[position] += 1;
      } else {
          this.hourDutyAs[position] = hours;
          this.countDutyAs[position] = 1;
      }
      this.sumDuty += hours;
      this.countDienste += 1;
  }

 /*
 Verwendet die aggregate Liste der DutyTypes um
 die aggregierte Summe an Diensten und Stunden
 für diesen DutyType (dutyType) zu erstellen
 dutyType - der dutyType für den diese aggregation
 gemacht werden soll
 visited - eine liste an bereits aggregierten dutytypes, damit
 sollen loops vermieden werden
 duty - das dict, dass die duty aufsummiert und zwar stunden (duty.hours) und dienste (duty.count)
 */
  aggregateDuty(dutyType, visited, duty) {
    if (duty == null) {
        duty = {};
        duty['hours'] = 0;
        duty['count'] = 0;
    }
    if (visited.includes(dutyType)) {
      throw "DutyCount#aggregateDuty --> Error Aggregate loop detected!";
    }
    visited.push(dutyType);
    if (dutyType in DUTY_TYPES) {
      if ("aggregate" in DUTY_TYPES[dutyType]) {
          //console.log("DutyCount#aggregateDuty --> need to aggregate! position " + position + " duty.count ist " + duty.count + " duty.hours " + duty.hours);
          for (let val of DUTY_TYPES[dutyType].aggregate) {
            var d = this.aggregateDuty(val, visited, duty);
            //console.log("duty.count ist " + duty.count);
            //console.log("Füge zu position " + position + " von position " + val + " count " + d.count + " hours " + d.hours + " hinzu " );
            //duty.hours += d.hours;
            //duty.count += d.count;
            //console.log("Somit ist count " + duty.count + " hours " + duty.hours);
          }
      } else if (dutyType in this.hourDutyAs) {
        //console.log("DutyCount#aggregateDuty --> simple add! postion: " + position + " count: " + this.countDutyAs[position] + " hours: " + this.hourDutyAs[position]);
        duty.hours += this.hourDutyAs[dutyType];
        duty.count += this.countDutyAs[dutyType];
      } else {
        //
      }
      console.log("DutyCount#aggregateDuty --> return duty for " + dutyType + " is: duty.count " + duty.count + " duty.hours " + duty.hours);
      return duty;
    } else {
      throw "Unbekannte position/Diensttyp!!";
    }
  }

  getDutyCount(position) {
      return this.aggregateDuty(position, [], null).count;
  }

  getDutyHours(position) {
    return this.aggregateDuty(position, [], null).hours;
  }

  getDuty(type$position) {
    var position = type$position.split("$")[1];
    if (type$position.includes("hourduty")) {
        return this.getDutyHours(position);
    } else if(type$position.includes("countduty")) {
        return this.getDutyCount(position);
    }
  }

}


/*
  verwandelt ein javascript Datum: Date in
  den üblicherweise vom Niu verwendeten Datumstring: dd.MM.YYYY
  date - das datum als Date object
  return - der DatumsString
*/
function getNiuDateString(date) {
  var todaysDate = date;
  var todaysDatePlus = todaysDate.getMonth() + 1; // Weil im Datumsobjekt Januar = 0
  var todaysDateString = todaysDate.getDate() + "." + todaysDatePlus + "." + todaysDate.getFullYear();
  return todaysDateString;
}

/*
  berechnet diverse statistiken wie
  Dienststunden, Dienste, Dienste auf der jeweiligen positione
  aus der EmployeeDutyStatistic

  Position können sein: SEFNFR, NFR1, NFR2, SEFKTW, SAN1, SAN2, RS (SAN1 + SEFKTW + (?NFR2) + NFR1 + SEFNFR), NFS (SEFNFR + NFR1)

  empID : String - die NIU EmployeeNumberID des Mitarbeiters
  reqtype : String[] - welche Statistik soll erstellt werden
   -> unterstützt werden im Moment:
      * stunden (Anzahl der Dienststunden gruppiert nach Position)
      * dienste (Anzahl der Dienste gruppiert nach Position)
   reqStartDate - Abfragezeitraum Beginn (wird noch ignoriert!)
   reqEndDate - Abfragezeitraum Ende (wird noch ignoriert!)
   return: eine Instanz von DutyType

*/
function calculateDutyStatisticNonCached(args) {
    // return new Promise(function(resolve, reject) {
        var empID = args.empID;
        var reqtype = args.reqtype;
        var reqStartDate = args.reqStartDate;
        var reqEndDate = args.reqEndDate;

        var post = {};
        console.log("calculateDutyStatisticNonCached --> start");

        return $.get("https://niu.wrk.at/Kripo/DutyRoster/EmployeeDutyStatistic.aspx?EmployeeNumberID=" + empID)
        .then( function(data) {
            console.log("calculateDutyStatisticNonCached --> rcv from get EmployeDutyStatistic.aspx");
            //console.log("statcalc --> rcv from get EmployeeDutyStatistic.aspx" + data);
            var jData = $(data);

            var keyPostfix = jData.find("#__KeyPostfix").val();
            var eventvalidation = jData.find("#__EVENTVALIDATION").val(); //jData.find("input[name=__EVENTVALIDATION]").val();

            var reqDate = new Date();
            reqDate.setMonth(reqDate.getMonth() - 6);
            // var reqDatePlus = reqDate.getMonth() + 1; // Weil im Datumsobjekt Januar = 0
            // var reqDateString = reqDate.getDate() + "." + reqDatePlus + "." + reqDate.getFullYear();
            var reqDateString = getNiuDateString(reqDate);

            var todaysDateString = getNiuDateString(new Date());
            // var todaysDate = new Date();
            // var todaysDatePlus = todaysDate.getMonth() + 1; // Weil im Datumsobjekt Januar = 0
            // var todaysDateString = todaysDate.getDate() + "." + todaysDatePlus + "." + todaysDate.getFullYear();

            console.log("calculateDutyStatisticNonCached --> request dates FROM: " + reqDateString + " // TO: " + todaysDateString);

            post["__KeyPostfix"] = keyPostfix;
            post["__EVENTVALIDATION"] = eventvalidation;
            post["__VIEWSTATE"] = "";
            post["__EVENTARGUMENT"] = "";
            post["__EVENTTARGET"] = "ctl00$main$m_Submit";
            post["ctl00$main$m_From$m_Textbox"] = reqDateString;
            post["ctl00$main$m_Until$m_Textbox"] = todaysDateString;
            post["&ctl00$main$m_JoinBrokenDuties"] = "on";

            return $.ajax({
                url: "https://niu.wrk.at/Kripo/DutyRoster/EmployeeDutyStatistic.aspx?EmployeeNumberID=" + empID,
                data: post,
                type: "POST",
            });
        }).then( function(data) {
                    //console.log("statcalc --> rcv status " + status);
            //console.log("statcalc --> rcv data " + data);

            // Weitere Schritte fuer die Berechnung
            // Statistikseite fuer die angeforderten Daten in der Variable 'data'


            var dienstnummer = $(data).find('h3').first().text().substring($(data).find('h3').first().text().indexOf('(')).replace('(', '').replace(')', '').trim();
            console.log('Dienstnummer: ' + dienstnummer);

            var duty = new DutyCount();

            // iterate data of each row
            var $tables = $(data).find('div.MultiDutyRoster');
            $tables.find('table.MessageTable').each(function(i) {

                // add placholder for statistics
                //$(this).find('tbody tr').first().after('<tr><td><table class="DutyRoster" cellspacing="0" cellpadding="3" rules="all" border="1"><tbody><tr><td id="charts' + i + '"></td></tr></tbody></table></td></tr>');

                // add header for duty duration
                //$(this).find('td.DRCTime').first().after('<td class="DRCDuration" width="50px">Dauer</td>');

                var tableType = $(this).find('td.MessageHeader').text();



                $(this).find('table#DutyRosterTable tbody tr').each(function() {

                    $(this).find('td').each(function(i, val) {
                        val = val.innerHTML.replace('&nbsp;', '').replace('<em>', '').replace('</em>', '').trim();

                        //TODO: unterscheide zwischen NFR & KTW

                        var isKTW = tableType.includes('KTW');
                        var isNFR = tableType.includes('RKS') || tableType.includes('RKL') || tableType.includes('RKP');

                        if (! (isKTW || isNFR)) {
                          return; //nicht rd streichen!
                        }
                        //console.log("duty roster parse: index " + i + " val " + val);

                        switch (i) {
                            case 0: // Wochentag

                                break;
                            case 1: // Datum
                                currentDateString = val;
                                break;
                            case 2: // Zeiten
                                hours = getDurationFromTimeString(currentDateString, val);
                                $(this).after('<td>' + hours + '</td>');
                                //sumDuty += hours;
                                break;
                            case 3: // Dienststellen

                                break;
                            default:
                                break;
                        }
                        //TODO: den doppelten Code reduzieren durch geschicktere Anordnung if else switch

                        var offset = 0;
                        if (tableType.includes('geplant')) {
                          offset = 1; //weil die spalten um eines verschoben sind! bei den geplanten Diensten fehlt die Spalte KFZ!
                        }
                        if (tableType.includes('fixiert')) {

                        }

                        switch (i + offset) {
                            case 5: // Fahrer
                            case 6: // SAN1
                            case 7: // SAN2
                                if (!$(val).text().includes(dienstnummer) && $(val).text() !== '') {
                                    //var kollege = $(val).text().substring(0, $(val).text().indexOf('(')).trim();

                                } else if ($(val).text() !== '') {
                                    switch (i + offset) {
                                        case 5: // SEF
                                          //console.log("add as fahrer! offset is " + offset + " index is " + i);
                                            if (isNFR) {
                                                duty.addHourDutyAs('SEFNFR', hours);
                                            }
                                            if (isKTW) {
                                                duty.addHourDutyAs('SEFKTW', hours);
                                            }
                                            break;
                                        case 6: // SAN1
                                          //console.log("add as san1!");
                                            if (isNFR) {
                                                duty.addHourDutyAs('NFR1', hours);
                                            }
                                            if (isKTW) {
                                                duty.addHourDutyAs('SAN1', hours);
                                            }
                                            break;
                                        case 7: // SAN2
                                          //console.log("add as SAN2");
                                            if (isNFR) {
                                                duty.addHourDutyAs('NFR2', hours);
                                            }
                                            if (isKTW) {
                                                duty.addHourDutyAs('SAN2', hours);
                                            }
                                            break;
                                        default:
                                            break;
                                    }
                                }
                                break;
                            default:
                                break;
                        }
                    });
                });
            }); //ende der each schleife über die duty tabellen

            //Ambulanzen auswerten!

            console.log("calculateDutyStatisticNonCached --> Ambulanzen auswerten!");
            //console.log("show data: " +  data);
            var ambTables = $(data).find('table.AmbulanceTable');
            ambTables.each(function(index) {
              $(this).find("tr:gt(0)").each(function(index) {
                //console.log("calculateDutyStatisticNonCached --> iterate over ambulanz rows index: " + index + " inhalt: " + $(this).text());
                var position = "AMB_SONSTIGE";
                var hours = 0;
                $(this).find("td").each(function(index) {
                  //console.log("calculateDutyStatisticNonCached --> iterate over ambulanz spalten index: " + index + " inhalt: " + $(this).text());
                  switch(index) {
                    case 0: //amb-nummer
                      break;
                    case 1: //subnr
                      break;
                    case 2: //Beschreibung
                      break;
                    case 3: //Funktion
                      var f = $(this).text();
                      if (f == "009 H" || f == "004 KTWF") {
                          position = "AMB_RS";
                      } else if (f.includes("NFS")) {
                          position = "AMB_NFS";
                      } else if (f == "011 PH" || f == "051 AZU") {
                        position = "AMB_RSIA";
                      }

                      //mal egal

                      break;
                    case 4:
                      if (!$(this).text().includes(dienstnummer)) {
                        return; //lasse andere Dienstnummern als die unter dienstnummer erkannte aus!
                      }
                      break;
                    case 8: //Stunden
                      hours = parseFloat($(this).text().replace(",","."));
                      break;
                  }
                });
                if (hours > 0) {
                  duty.addHourDutyAs(position, hours);
                  duty.addHourDutyAs("AMB_ALL", hours);
                } else {
                  console.log("hours <= 0!");
                }
              });
            });
            //console.log("calculateDutyStatisticNonCached --> return duty.getDutyCount: " + duty.getDutyCount('NFR1'));
            //console.log("calculateDutyStatisticNonCached --> return duty.getDutyCount: " + duty.getDutyCount('AMB'));
            return duty;

  }); // letzter .then block

}

function checkCourseAttendance(empID, courseDict) {
return getFromCache("courseattend_", empID + courseDict.UID, { 'empID' : empID, 'courseDict' : courseDict}, checkCourseAttendanceNotCached);
}

//TODO: $.get liefert schon ein promise zurück, somit ist das new Promise unnötig
function checkCourseAttendanceNotCached(args) {

    // Function accepts courseDict in format of:
    //var courseDict = {
    //                    UID : "Unique ID for Cache"
    //                    kurs1 : { "Name" : "Main Course Name", "altName1" : "Alternative Name 1", "altName2" : "Alternative Name 2", "absolved" : "?" },
    //                    kurs2 : { "Name" : "Main Course Name", "altName1" : "Alternative Name 1", "altName2" : "Alternative Name 2", "absolved" : "?" },
    //                    kurs3 : { "Name" : "Main Course Name", "altName1" : "Alternative Name 1", "altName2" : "Alternative Name 2", "absolved" : "?" }
    // [... unlimited additions to dictionary possible but format has to remain the same! ]
    //                  };

    var courseDict = args.courseDict;
    var empID = args.empID;

    return new Promise(function(resolve, reject) {
    var post = {};

        $.get("https://niu.wrk.at/Kripo/Kufer/SearchCourse.aspx?EmployeeId=" + empID, function(data) {
            var jData = $(data);

            var keyPostfix = jData.find("#__KeyPostfix").val();
            var eventvalidation = jData.find("#__EVENTVALIDATION").val(); //jData.find("input[name=__EVENTVALIDATION]").val();

            var todaysDate = new Date();
            var todaysDatePlus = todaysDate.getMonth() + 1; // Weil im Datumsobjekt Januar = 0
            var todaysDateString = todaysDate.getDate() + "." + todaysDatePlus + "." + todaysDate.getFullYear();

            post["__KeyPostfix"] = keyPostfix;
            post["__EVENTVALIDATION"] = eventvalidation;
            post["__VIEWSTATE"] = "";
            post["__EVENTARGUMENT"] = "";
            post["__EVENTTARGET"] = "ctl00$main$m_Search";
            post["ctl00$main$m_From$m_Textbox"] = "01.01.1995";
            post["ctl00$main$m_Until$m_Textbox"] = todaysDateString;
            post["ctl00$main$m_Options$0"] = "on";
            post["ctl00$main$m_Options$2"] = "on";
            post["ctl00$main$m_Options$5"] = "on";
            post["ctl00$main$m_CourseName"] = "";


            $.ajax({
                url: "https://niu.wrk.at/Kripo/Kufer/SearchCourse.aspx?EmployeeId=" + empID,
                data: post,
                type: "POST",
                success: function(data, status) {

                    var absolvedCourses = [];

                    $(data).find(".CourseTitel").each(function(index, element) {
                    absolvedCourses.push($(element).text());
                    });

                    for(var course in courseDict) {

                    var found = false;

                    if($.inArray(courseDict[course].Name, absolvedCourses) !== -1) { found = true; }
                    if($.inArray(courseDict[course].altName1, absolvedCourses) !== -1) { found = true; }
                    if($.inArray(courseDict[course].altName2, absolvedCourses) !== -1) { found = true; }

                    if(found === true) { courseDict[course].absolved = "ja"; } else { courseDict[course].absolved = "nein"; }

                    }
                    resolve(courseDict) //Ausgabe des Ergebnisses

                }
            });
      });
    });
}

function getFreeEmployeeDNRs() {
return new Promise(function(resolve, reject) {
       $.get("https://niu.wrk.at/Kripo/external/ControlCenterHead.aspx", function(data) {
          console.log("getFreeEmployeeDNRs --> parse get request data");

          var numArray = [];
          var mia= [];
          var regexpr = /\((.*?)\)/;

          $(data).find('#m_ddlEmployee option').each(function(index,element) {
             var searchString = encodeURI($(element).text());
             var foundDNR = regexpr.exec(searchString);
             numArray.push(parseInt(foundDNR[1]));
          });

          numArray.sort();

          // Hier wird der Mittelwert aller Dienstnummern in der Liste ermittelt
          // wodurch der hauefigst vorkommende DNr-Bereich ermittelt wird.
          // Dies soll verhindern das Dienstnummern fuer andere BezSt ausgegeben werden.

          // TODO: Erkennen anderer DNr Bereiche, Dialog zur Auswahl des DNr Bereichs wenn
          // mehrere Bereiche erkannt wurden.

           var total = 0;
           for(var i = 0; i < numArray.length; i++) {
           total += numArray[i];
           }
           var avg = total / numArray.length;

           var thresholdLOW = Math.floor(avg/1000)*1000;
           var thresholdUP = Math.ceil(avg/1000)*1000;

           // Thanks to
           // http://stackoverflow.com/questions/7317993/arrays-find-missing-numbers-in-a-sequence
           // for the (modified) function below:

           for(var i = 1; i < numArray.length; i++)
           {
           if(numArray[i] - numArray[i-1] != 1)
           {
            var x = numArray[i] - numArray[i-1];
            var j = 1;
            while (j<x)
            {
                var proposedNumber = numArray[i-1]+j;
                if((proposedNumber > thresholdLOW && proposedNumber < thresholdUP)) {
                mia.push(proposedNumber);
                }
                j++;
            }
            }
            }
           resolve(mia);
          });

          });
       }
