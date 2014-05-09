/*
	RCP Vista Demonstrator
	Author: Chris Casey
	Copyright 2013 CPC Computer Solutions Ltd.
 
   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at
 
       http://www.apache.org/licenses/LICENSE-2.0
 
   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

module.exports = {
	userLogin: function(params,ewd) {
		var authP=new ewd.mumps.GlobalNode("%zewdTemp",[process.pid]);
		authP._delete();
		authP._setDocument({'inputs':{'password':params.password,'username':params.username}});
		var result=ewd.mumps.function('login^ZZCPCR00','xx');
		if (result != '') return result;
		var document=authP._getDocument();
		ewd.session.$('username')._value = params.username;
		ewd.session.$('userDUZ')._value = document.outputs.DUZ;
		ewd.session.$('displayName')._value = document.outputs.displayName;
		ewd.session.setAuthenticated();
		ewd.sendWebSocketMsg({
			type: 'loggedInAs',
			message: {
			  fullName: document.outputs.displayName
			}
		});
		return '';
	},

	simplePatientLookup : function(params,ewd) {
      if (!patientIndex) var patientIndex = new ewd.mumps.GlobalNode("DPT", ["B"]);
      var results = [];
      var names = {};
      var i = 0;
      patientIndex._forPrefix(params.prefix.toUpperCase(), function(name, node) {
        node._forEach(function(id) {
          i++;
          if (i > 40) return true;
          results.push({id: id, text: name});
          names[id] = name;
        });
        if (i > 40) return true;
      });
      ewd.session.$('names')._delete();
      ewd.session.$('names')._setDocument(names);
      ewd.sendWebSocketMsg({
        type: 'patientMatches',
        message: results
      });
      return;
	},
	simpleDrugLookup: function(params,ewd) {
		if (!reactantIndex) var reactantIndex = new ewd.mumps.GlobalNode("GMRD", ["120.82","B"]);
		if (!NatDrugIndex) var NatDrugIndex= new ewd.mumps.GlobalNode("PSNDF", ["50.6","B"]);
		var results = [];
		var names={};
		var i=0;
		var file=';PSNDF(50.6,';
		names[file]=0;
		NatDrugIndex._forPrefix(params.prefix.toUpperCase(), function(name,node) {
			node._forEach(function(id) {
				i++;
				if (i>30) return true;
				var zid=''+id+file;
				results.push({id:zid, text: name});
				names[zid] = name;
			});
			if (i>30) return true;
		});
		var file=';GMRD(120.82,'; //;GMRD(120.82,
		names[file]=0;
		reactantIndex._forPrefix(params.prefix.toUpperCase(), function(name, node) {
			node._forEach(function(id) {
				i++;
				if (i>40) return true;
				var zid=''+id+file;
				results.push({id: zid, text: name});
				names[zid] = name;
			});
			if (i>40) return true;
		});
		ewd.session.$('reactants')._delete();
		ewd.session.$('reactants')._setDocument(names);
		ewd.sendWebSocketMsg({
			type: 'drugMatches',
			message: results
		});
		
	  return;
	},
	simpleSymptomLookup: function(params,ewd) {
		if (!symptomIndex) var symptomIndex = new ewd.mumps.GlobalNode("GMRD", ["120.83","B"]);
		var results = [];
		var names={};
		var i=0;
		symptomIndex._forPrefix(params.prefix.toUpperCase(), function(name, node) {
			node._forEach(function(id) {
				i++;
				if (i>40) return true;
				results.push({id: id, text: name});
				names[id] = name
			});
			if (i>40) return true;
		});
		ewd.session.$('symptoms')._delete();
		ewd.session.$('symptoms')._setDocument(names);
		ewd.sendWebSocketMsg({
			type: 'symptomMatches',
			message: results
		});
	  return;
	},
	//improved get stats to include age and wards in one call
	getStats : function(params,ewd) {
		var allStatsRes = new ewd.mumps.GlobalNode("%zewdTemp",[process.pid]);
		allStatsRes._delete();
		var result=ewd.mumps.function('getPatientSummary^ZZCPCR00','xx');
		var document=allStatsRes._getDocument();
		allStatsRes._delete();
		ewd.session.$('wards')._delete();
		ewd.session.$('wards')._setDocument(document.outputs.wards);
		ewd.session.$('ages')._delete();
		ewd.session.$('ages')._setDocument(document.outputs.ages);
		ewd.session.$('patients')._delete();
		ewd.session.$('patients')._setDocument(document.outputs.patients);
		ewd.sendWebSocketMsg({
			type:'wardStats',
			message:document.outputs.wards
		})
		/*
		ewd.sendWebSocketMsg({
			type:'patientSummaryList2',
			message:document.outputs.patients
		})
		*/
		ewd.sendWebSocketMsg({
			type:'ageStats',
			message:document.outputs.ages
		})
	},
	//no longer used
	getStatsOLD : function(params,ewd) {
		if (!wardIndex) var wardIndex = new ewd.mumps.GlobalNode("DPT", ["CN"]);
		var results = [];
		var wards={};
		wardIndex._forEach(function(wname,node) {
			node._forEach(function(pno) {
				if (!wards[wname]) {
					wards[wname]={};
					wards[wname].total=0;
					wards[wname].patients=[];
				};
				wards[wname].total++;
				wards[wname].patients.push(pno);
				//results.push({ward:wname,patientid:pno});
			})
		})
      ewd.session.$('wards')._delete();
      ewd.session.$('wards')._setDocument(wards);
		//for (wardname in wards) {results.push({ward:wardname,value:wards[wardname].total})};
		ewd.sendWebSocketMsg({
			type:'wardStats',
			message:wards
		})
		return;
	},
	getPatientsByWard: function(params,ewd) {
		var results=[];
		var wards=ewd.session.$('wards')._getDocument();
		var patients=wards[params.wardName].patients;
		var allPatients=ewd.session.$('patients')._getDocument();
		for (patientId in patients){
			results.push(allPatients[patientId]);
		}
		ewd.sendWebSocketMsg({
			type:'patientSummaryList',
			message:results
		})
		return;
	},
	getPatientsByAge: function(params,ewd) {
		var results=[];
		var ages=ewd.session.$('ages')._getDocument();
		var patients=ages[params.ageRange].patients;
		var allPatients=ewd.session.$('patients')._getDocument();
		for (patientId in patients){
			results.push(allPatients[patientId]);
		}
		ewd.sendWebSocketMsg({
			type:'patientSummaryList',
			message:results
		})
		return;
	},
	//This no longer used
	getPatientSummary: function(patientId,ewd) {
		var patient= new ewd.mumps.GlobalNode("DPT", [patientId,'0']);
		var patientRec0=patient._value;
		var patientObj=patientRec0.split('^');
		return {id:patientId,name:patientObj[0],sex:patientObj[1],DOB:this.convertFtoStringDate(patientObj[2]),SSN:patientObj[8]}
	},
	
	listPics: function(patientId,ewd) {
		var picsP = new ewd.mumps.GlobalNode("MAG", [2005,"AC", patientId]);
		var pics=[];
		var picsInx={
			4:{34:4,38:71,40:51,41:52},
			22:{54:80,55:80,56:110,59:82,60:82,65:81,66:81}
		}
		var picsList=picsP._getDocument();
		for (ien in picsList) {
			var thisPicP = new ewd.mumps.GlobalNode("MAG", [2005,ien])
			var thisPic=thisPicP._getDocument();
			//var pic0=thisPic[0]._value;
			//var pic2=thisPic[2]._value;
			var pic0=thisPic[0].split("^");
			var pic2=thisPic[2].split("^");
			if (pic0[1]=='') continue; //ignore if no file in record
			var procX=''; if (picsInx[patientId]) if (picsInx[patientId][ien]) procX=picsInx[patientId][ien];
			pics.push({file:pic0[1],type:pic0[5],proc:pic0[7],description:pic2[3], procedure:procX});
		};
		ewd.sendWebSocketMsg({
			type:'pictures',
			message: pics
		})
		return;
	},
	//^DGPF(26.13,"B",19,*)
	listSafeties: function(patientId, ewd) {
		var safetyIxP = new ewd.mumps.GlobalNode("DGPF", [26.13,"B",patientId]);
		var safetyAlerts=[];
		var safetyList=safetyIxP._getDocument();
		for (ien in safetyList) {
			safetyAlerts.push(this.getSafety(patientId,ien,ewd));
		};
		ewd.sendWebSocketMsg({
			type: 'safetyAlerts',
			message: safetyAlerts
		});
	},
	getSafety: function(patientId,safetyId,ewd) {
		var safetyRes = new ewd.mumps.GlobalNode("%zewdTemp", [process.pid]);
		safetyRes._delete();
		safetyRes._setDocument({'inputs':{'fileNo':26.13, 'patientId':patientId, 'recordId':safetyId}});
		var result=ewd.mumps.function('gets^ZZCPCR00','xx');
		var document=safetyRes._getDocument();
		safetyRes._delete();
		//console.log(JSON.stringify(document.outputs));
		return document.outputs;	
	},
	listComplaints: function(patientId,ewd) {
		var complaintsP = new ewd.mumps.GlobalNode("AUPNVNT", ["AC",patientId]);
		var complaints=[];
		var complaintsList=complaintsP._getDocument();
		for (ien in complaintsList) {
			complaints.push(this.getComplaint(patientId,ien,ewd));
		};
		ewd.sendWebSocketMsg({
			type: 'complaintCount',
			message: complaints
		});
		return;
	},
	getComplaint: function(patientId,complaintId,ewd) {
		var complaintRes = new ewd.mumps.GlobalNode("%zewdTemp",[process.pid]);
		complaintRes._delete();
		complaintRes._setDocument({'inputs':{'fileNo':9000010.34,'patientId':patientId,'recordId':complaintId}});
		var result=ewd.mumps.function('gets^ZZCPCR00','xx');
		var document=complaintRes._getDocument();
		complaintRes._delete();
		//console.log(JSON.stringify(document.outputs));
		return document.outputs;
	},
	listVisits: function(patientId,ewd) {
		var visitsP = new ewd.mumps.GlobalNode("AUPNVSIT", ["C",patientId]);
		var visits=[];
		var visitsList=visitsP._getDocument();
		for (ien in visitsList) {
			visits.push(this.getVisit(patientId,ien,ewd));
		};
		ewd.sendWebSocketMsg({
			type:'visitCount',
			message :visits
			});
		return;
	},
	getVisit: function(patientId,visitId,ewd) {
		var visitRes = new ewd.mumps.GlobalNode("%zewdTemp",[process.pid]);
		visitRes._delete();
		visitRes._setDocument({'inputs':{'fileNo':9000010,'patientId':patientId,'recordId':visitId}});
		var result=ewd.mumps.function('gets^ZZCPCR00','xx');
		var document=visitRes._getDocument();
		visitRes._delete();
		//console.log(JSON.stringify(document.outputs));
		return document.outputs;
	},	
	listVitals: function(patientId,ewd) {
		var vitalsX= new ewd.mumps.GlobalNode("PXRMINDX", [120.5,"PI",patientId]);
		var vitals=[];
		var vitalsList= vitalsX._getDocument();
		for (type in vitalsList) {
			for (date in vitalsList[type]) {
				for (ien in vitalsList[type][date]) {
					vitals.push(this.getVital(patientId,ien,ewd))
				}
			}
		};
	//	for (ien in vitalsList) {
	//		vitals.push(this.getVital(patientId,ien,ewd));
	//	};
		ewd.sendWebSocketMsg({
			type:'vitalCount',
			message :vitals
			});
		return;
	},
	getVital: function(patientId,problemId,ewd) {
		var vitalRes = new ewd.mumps.GlobalNode("%zewdTemp",[process.pid]);
		vitalRes._delete();
		vitalRes._setDocument({'inputs':{'fileNo':120.5,'patientId':patientId,'recordId':problemId}});
		var result=ewd.mumps.function('gets^ZZCPCR00','xx');
		var document=vitalRes._getDocument();
		vitalRes._delete();
		//console.log(JSON.stringify(document.outputs));
		return document.outputs;
	},	
	listProblems: function(patientId,ewd) {
		var problemsX= new ewd.mumps.GlobalNode("AUPNPROB", ["AC",patientId]);
		var problemList=problemsX._getDocument(); //this is shorter than method above but makes it harder to count on front end
		var problems=[];
		for (ien in problemList) {
			problems.push(this.getProblem(patientId,ien,ewd));
		}
		ewd.sendWebSocketMsg({
			type:'problemCount',
			message:problems
			});
		return;	
	},
	getProblem: function(patientId,problemId,ewd) {
		var problemRes = new ewd.mumps.GlobalNode("%zewdTemp",[process.pid]);
		problemRes._delete();
		problemRes._setDocument({'inputs':{'fileNo':9000011,'patientId':patientId,'recordId':problemId}});
		var result=ewd.mumps.function('gets^ZZCPCR00','xx');
		var document=problemRes._getDocument();
		problemRes._delete();
		//console.log(JSON.stringify(document.outputs));
		return document.outputs;
	},
	listProcedures: function(patientId,ewd) {
		var proceduresX= new ewd.mumps.GlobalNode("AUPNVCPT", ["C",patientId]);
		var procedureList=proceduresX._getDocument();
		var procedures=[];
		for (ien in procedureList) {
			procedures.push(this.getProcedure(patientId,ien,ewd));
		}
		ewd.sendWebSocketMsg({
			type:'procedureCount',
			message:procedures
			});
		return;	
	},
	getProcedure: function(patientId,procedureId,ewd) {
		var procedureRes = new ewd.mumps.GlobalNode("%zewdTemp",[process.pid]);
		procedureRes._delete();
		procedureRes._setDocument({'inputs':{'fileNo':9000010.18,'patientId':patientId,'recordId':procedureId}});
		var result=ewd.mumps.function('gets^ZZCPCR00','xx');
		var document=procedureRes._getDocument();
		procedureRes._delete();
		//console.log(JSON.stringify(document.outputs));
		return document.outputs;
	},
	listMedications: function(patientId,ewd) {
		var medicationsX= new ewd.mumps.GlobalNode("PS", [55,"B",patientId]);
		var medicationList=medicationsX._getDocument();
		var medications=[];
		for (ien in medicationList) {
			medications.push(this.getMedication(patientId,ien,ewd));
		}
		ewd.sendWebSocketMsg({
			type:'medicationCount',
			message:medications
			});
		return;	
	},
	getMedication: function(patientId,medicationId,ewd) {
		var medicationRes = new ewd.mumps.GlobalNode("%zewdTemp",[process.pid]);
		medicationRes._delete();
		medicationRes._setDocument({'inputs':{'fileNo':55,'patientId':patientId,'recordId':medicationId}});
		var result=ewd.mumps.function('gets^ZZCPCR00','xx');
		var document=medicationRes._getDocument();
		medicationRes._delete();
		//console.log(JSON.stringify(document.outputs));
		return document.outputs;
	},
	listAlerts: function(patientId,ewd) {
		var pAlertPoint = new ewd.mumps.GlobalNode("XTV",[8992.1,"C",patientId]);
		var alertList=pAlertPoint._getDocument();
		var alerts=[];
		for (ien in alertList) {
			alerts.push(this.getAlert(patientId,ien,ewd));
		}
		ewd.sendWebSocketMsg({
			type: 'alertCount',
			message: alerts
		});
	},
	getAlert: function(patientId,problemId,ewd) {
		var alertRes = new ewd.mumps.GlobalNode("%zewdTemp",[process.pid]);
		alertRes._delete();
		alertRes._setDocument({'inputs':{'fileNo':8992.1,'patientId':patientId,'recordId':problemId}});
		var result=ewd.mumps.function('gets^ZZCPCR00','xx');
		var document=alertRes._getDocument();
		alertRes._delete();
		//console.log(JSON.stringify(document.outputs));
		return document.outputs;
	},
	listAllergies: function(patientId,ewd) {
		var pAllergiePoint = new ewd.mumps.GlobalNode("GMR",[120.8,"B",patientId]);
		var allergieList=pAllergiePoint._getDocument();
		var allergies=[];
		for (ien in allergieList) {
			allergies.push(this.getAllergy(patientId,ien,ewd));
		}
		ewd.sendWebSocketMsg({
			type: 'allergieCount',
			message: allergies
		});
	},
	getAllergy: function(patientId,allergyId,ewd) {
		var allergyRes = new ewd.mumps.GlobalNode("%zewdTemp",[process.pid]);
		allergyRes._delete();
		allergyRes._setDocument({'inputs':{'fileNo':120.8,'patientId':patientId,'recordId':allergyId}});
		var result=ewd.mumps.function('gets^ZZCPCR00','xx');
		var document=allergyRes._getDocument();
		allergyRes._delete();
		//console.log(JSON.stringify(document.outputs));
		return document.outputs;
	},
	listOrders: function(patientId,ewd) {
		var pOrdPoint= new ewd.mumps.GlobalNode("DPT",[patientId,"LR"]);
		var pLabId=pOrdPoint._value;
		var orders=[];
		if (!pLabId) {
			ewd.sendWebSocketMsg({
				type:'orderCount',
				message :orders
				});
			return orders;
		};
		var pOrdX = new ewd.mumps.GlobalNode("LRO",[69,"D",pLabId]);
		var orderList=pOrdX._getDocument();
		for (date in orderList) {
			for (LabIen in orderList[date]) {
				var ienPoint= new ewd.mumps.GlobalNode("LRO",[69,date,1,LabIen,0]);
				var x=ienPoint._value;
				var OrderNo=x.split("^")[10]; //piece 11 but 0 based
				orders.push(this.getOrder(patientId,OrderNo,ewd));
			}
		};
		ewd.sendWebSocketMsg({
			type:'orderCount',
			message :orders
			});
		return;
	},
	getOrder: function(patientId,orderIen,ewd) {
		var orderRes = new ewd.mumps.GlobalNode("%zewdTemp",[process.pid]);
		orderRes._delete();
		orderRes._setDocument({'inputs':{'fileNo':100,'patientId':patientId,'recordId':orderIen}});
		var result=ewd.mumps.function("gets^ZZCPCR00","xx");
		var document=orderRes._getDocument();
		orderRes._delete();
		//console.log(JSON.stringify(document.outputs));
		return document.outputs;
	},
	getDemographics: function(patientId,ewd) {
		var demographics = new ewd.mumps.GlobalNode("%zewdTemp",[process.pid]);
		demographics._delete();
		demographics._setDocument({'inputs':{'DFN':patientId}});
		var result=ewd.mumps.function('wrapGetDemographics^ZZCPCR00','xx');
		var document=demographics._getDocument();
		demographics._delete();
		ewd.sendWebSocketMsg({
			type:'demographics',
			message:document.outputs
		})
		return document.name;
	},
	addAllergy: function(inputs,ewd) {
		var allergy = new ewd.mumps.GlobalNode("%zewdTemp",[process.pid]);
		allergy._delete();
		allergy._setDocument({'inputs': inputs});
		var result=ewd.mumps.function('wrapNewAllergy^ZZCPCR00','xx');
		if (result!='') return result;
		var document=allergy._getDocument();
		allergy._delete();
		this.listAllergies(inputs.patientId,ewd) ; //refresh allergy count and list
		ewd.sendWebSocketMsg({
			type: 'newAllergyCreated',
			message: document.outputs
		});
		
		return;
	},
	convertFtoStringDate: function(x) {var x=x.toString(); x=x.slice(5,7)+'/'+x.slice(3,5)+'/'+(parseInt(x.slice(0,3))+1700); return x}
	
};
