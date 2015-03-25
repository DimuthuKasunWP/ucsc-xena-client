/*jslint browser:true, nomen: true */
/*global define: false, confirm: true */

define(["dom_helper", "xenaQuery", "session", "underscore_ext", "rx-dom", "xenaAdmin",'../images/Treehouse.jpg','jquery', 'jquery-ui', "base", "../css/datapages.css"],
	function (dom_helper, xenaQuery, session, _, Rx, xenaAdmin, treehouseImg, $) {
	'use strict';

	var allHosts, /* hosts is the variable holds all hosts*/
		activeHosts,
		userHosts,
		localHost,
		metadataFilterHosts,
		state,
		query_string = dom_helper.queryStringToJSON(),  	//parse current url to see if there is a query string
		baseNode = document.getElementById('main'),
		container, sideNode, mainNode,
		COHORT_NULL = '(unassigned)',
		TYPE_NULL = 'unknown',
		NOT_GENOMICS = ["sampleMap", "probeMap", "genePred", "genePredExt","genomicSegment"],
		FORMAT_MAPPING = {
			'clinicalMatrix':"ROWs (samples)  x  COLUMNs (identifiers)",
			'genomicMatrix':"ROWs (identifiers)  x  COLUMNs (samples)",
			'mutationVector':"Mutation by Position",
			TYPE_NULL:"unknown",
			'unknown': "unknown"
		};

	session.sessionStorageInitialize();
	state = JSON.parse(sessionStorage.state);
	allHosts = state.allHosts; // all hosts
	activeHosts = state.activeHosts; // activetHosts
	userHosts = state.userHosts; // selectedtHosts
	localHost = state.localHost; //localhost
	metadataFilterHosts = state.metadataFilterHosts; // metadataFilter

	// check if there is some genomic data for the cohort, if goodsStatus is a parameter, also check if the genomic data meet the status
	function checkGenomicDataset(hosts, cohort, goodStatus) {
		return xenaQuery.dataset_list(hosts, cohort).map(function (s) {
			return s.some(function (r) {
				if (r.datasets) {
					return r.datasets.some(function (dataset) {
						var format = dataset.type,
								status = dataset.status;
						return ((goodStatus? (status === goodStatus): true) && (NOT_GENOMICS.indexOf(format) === -1));
					});
				}
				return false;
			});
		});
	}


	// check if there is some genomic data for the cohort, if goodsStatus is a parameter, also check if the genomic data meet the status
	function checkGenomicDatasetAllBad(hosts, cohort, goodStatus) {
		return xenaQuery.dataset_list(hosts, cohort).map(function (s) {
			return s.every(function (r) {
				if (r.datasets) {
					return r.datasets.some(function (dataset) {
						var format = dataset.type,
								status = dataset.status;
						return ((goodStatus? (status !== goodStatus): false) || (NOT_GENOMICS.indexOf(format) !== -1));
					});
				}
				return true;
			});
		});
	}

	// test if a legit chort exits, (i.e. with real genomic data), carry out action
	function ifCohortExistDo(cohort, hosts, goodStatus, action ) {
		checkGenomicDataset(hosts, cohort, goodStatus).subscribe(function (s) {
			if (s) {
				action.apply(null, arguments);
			}
		});
	}

	// test if a chort illegit, (i.e. no real genomic data), carry out action
	function ifCohortDoesNotExistDo(cohort, hosts, goodStatus, action ) {
		checkGenomicDatasetAllBad(hosts, cohort, goodStatus).subscribe(function (s) {
			if (s) {
				action.apply(null, arguments);
			}
		});
	}

	function deleteDataButton (dataset){
		var name = JSON.parse(dataset.dsID).name,
				host= JSON.parse(dataset.dsID).host;

		if((host ===localHost) && ((dataset.status === session.GOODSTATUS ) || (dataset.status === "error"))) {
			var deletebutton = document.createElement("BUTTON");
			deletebutton.setAttribute("class","vizbutton");
		  deletebutton.appendChild(document.createTextNode("Remove"));
			deletebutton.addEventListener("click", function() {
				var r = confirm("Delete \""+name + "\" from your local xena.");
				if (r === true) {
					xenaAdmin.delete(localHost, name).subscribe();
				  location.reload(); // reload current page
				}
		  });
		  return deletebutton;
		}
	}

	function cohortHeatmapButton(cohort, hosts, vizbuttonParent) {
		var vizbutton,
				goodStatus = session.GOODSTATUS;
  	ifCohortExistDo(cohort, _.intersection(_.intersection(activeHosts, hosts), userHosts), goodStatus, function(){
			vizbutton = document.createElement("BUTTON");
			vizbutton.setAttribute("class","vizbutton");
			vizbutton.appendChild(document.createTextNode("Visualize"));
			vizbutton.addEventListener("click", function() {
  			session.xenaHeatmapSetCohort(cohort);
  			location.href = "../heatmap/"; //goto heatmap page
			});
			vizbuttonParent.appendChild(vizbutton);
		});
	}


	function warningPopUp (node, loaderWarning){
		node.onclick = function(){
			var root = $('<div>')[0];
			$(root).dialog({
				modal: true,
				title: 'Loader Warning',
				position: ['center', 100],
				width:400
			});
			root.appendChild(document.createTextNode(JSON.stringify(loaderWarning)));
			return false;
		};
	}

	// short COHORT section detail
	function eachCohortDetail(cohortName, hosts, node) {
		var hostNode, tmpNode;

		// samples: N
		node.appendChild(dom_helper.labelValueNode("samples:", cohortName + "sampleN"));
		dom_helper.updateDOM_xenaCohort_sampleN(cohortName + "sampleN", hosts, cohortName);

		// update
		node.appendChild(dom_helper.valueNode(cohortName + "Update"));
		hosts.forEach(function (host) {
			xenaQuery.dataset_list([host], cohortName).subscribe(
				function (s) {
					var version;
					s[0].datasets.forEach(function (dataset) {
						var dataVersion = dataset.version;
						if (dataVersion) {
							if (!version) {
								version = dataVersion;
							} else if (version < dataVersion) {
								version = dataVersion;
							}
						}
					});
					if (version) {
						node = document.getElementById(cohortName + "Update");
						if (node.children.length === 0) {
							node.appendChild(dom_helper.elt("label", "updated on:"));
							node.appendChild(dom_helper.elt("result", version));
						} else {
							node.appendChild(dom_helper.elt("result", "; " + version));
						}
					}
				});
		});

		// host: xxx
		hostNode = dom_helper.valueNode(cohortName + "Hosts");
		hosts.forEach(function (host) {
			xenaQuery.all_cohorts(host).subscribe(function (s) {
				if (s.indexOf(cohortName) !== -1) {
					tmpNode= dom_helper.hrefLink(host, "?host=" + host);
					tmpNode.setAttribute("id","status"+host);
					if (hostNode.children.length === 0) {
						hostNode.appendChild(dom_helper.elt("label", "hosts:"));
					} else {
						hostNode.appendChild(document.createTextNode("; "));
					}
					hostNode.appendChild(tmpNode);
				}
			});
		});
		node.appendChild(hostNode);
	}

	// the short COHORT section with no detail, just name, vizbutton (if valid), img (optional)
	function eachCohortMultiple(cohortName, hosts, node) {
		var liNode = document.createElement("li"), img,
			nodeTitle = dom_helper.hrefLink(cohortName, "?cohort=" + encodeURIComponent(cohortName));

		img = getImage(cohortName);
		if (img){
			liNode.appendChild(img);
		}

		//for single active host but not selected by user senario
		if ((hosts.length===1) &&  (userHosts.indexOf(hosts[0])===-1)){
			nodeTitle.style.color="gray";
		}

		liNode.appendChild(nodeTitle);
		node.appendChild(liNode);
		cohortHeatmapButton(cohortName, _.intersection(activeHosts, userHosts), liNode);

		if (cohortName===COHORT_NULL){
			ifCohortDoesNotExistDo(cohortName, hosts, session.GOODSTATUS, function (){
				node.removeChild(liNode);
			});
		}
	}

	function getImage (cohortName){
		var img;
		if (cohortName.search(/^Treehouse/gi) !== -1){
			img = new Image();
  	  img.src = treehouseImg;
  	  img.height = "50";
    }
    return img;
	}

	function cohortListPage(hosts, rootNode) {
		if (!hosts || hosts.length === 0) {
			return;
		}

		var title = dom_helper.elt("h2", "Cohorts"),
			node;

		if (!hosts.some(function(host){
			if (_.intersection(activeHosts, userHosts).indexOf(host) !==-1) {return true;}
			else {return false;}
		})){
			title.style.color="gray";
		}
		node = dom_helper.sectionNode("cohort");
		rootNode.appendChild(node);
		node.appendChild(title);

		node = document.createElement("div");
		node.setAttribute("id","cohortList");
		rootNode.appendChild(node);
		rootNode.appendChild(document.createElement("div"));

		var source = Rx.Observable.zipArray(
			hosts.map(function (host) {
			 	return xenaQuery.all_cohorts(host);
			})
		);

		source.subscribe(function (x) {
			var cohortC = [];

			x.forEach(function(s){
				s.forEach(function (cohort) {
					if (cohortC.indexOf(cohort) === -1) {
						cohortC.push(cohort);
					}
				});
			});

			cohortC.sort(function (a,b){
				if (a===COHORT_NULL){
					return 1;
				}
				else if (b===COHORT_NULL){
					return -1;
				}
				return a.toLowerCase().localeCompare(b.toLowerCase());
			});

			cohortC.map(function(cohort){
				eachCohortMultiple(cohort, hosts, node);
			});
		});
	}

	//	build single COHORT page
	function cohortPage(cohortName, hosts, rootNode) {
		//cohort section
		var tmpNode,img,
		    node = dom_helper.sectionNode("cohort"),
		    vizbuttonParent;

		rootNode.appendChild(node);

		//title
		vizbuttonParent = dom_helper.elt("h2", "cohort: ");
		node.appendChild(vizbuttonParent);

		img = getImage(cohortName);
			if (img){
				vizbuttonParent.appendChild(img);
		}
		vizbuttonParent.appendChild(document.createTextNode(cohort));
		cohortHeatmapButton(cohortName, _.intersection(activeHosts, userHosts), vizbuttonParent);

		ifCohortExistDo (cohortName, hosts, undefined, function() {
			eachCohortDetail(cohortName, hosts, node);

			xenaQuery.dataset_list(hosts, cohortName).subscribe(
				function (s) {
					//collection information
					var dataType = {},
						dataLabel = {},
						dataDescription = {},
						dataHost = {},
						dataName = {},
						dataStatus ={},
						dataWarning={},
						dataCollection={};

					s.forEach(function (r) {
						var host = r.server,
							datasets = r.datasets;
						datasets.forEach(function (dataset) {
							var type = dataset.dataSubType,
								format = dataset.type,
								label = dataset.label? dataset.label: dataset.name,
								description = dataset.description,
								name = dataset.name,
								status = dataset.status,
								loaderWarning = dataset.loader,
								fullname = host + name;

							if (NOT_GENOMICS.indexOf(format) === -1) {
								if (!label) {
									label = name;
								}
								if (!(dataType[type])) {
									dataType[type] = [];
								}
								dataType[type].push(fullname);
								dataLabel[fullname] = label;
								dataDescription[fullname] = description;
								dataHost[fullname] = host;
								dataName[fullname] = name;
								dataStatus[fullname] = status;
								dataWarning[fullname] = loaderWarning;
								dataCollection[fullname]= dataset;
							}
						});
					});

					// dataType section
					var nodeDataType = dom_helper.sectionNode("dataType");

					var keys = Object.keys(dataType).sort(),
							displayType,
							listNode;
					keys.forEach(function (type) {
						displayType = type;
						if (type === "undefined") {
							displayType = "others";
						}
						nodeDataType.appendChild(dom_helper.elt("header", displayType));
						listNode = dom_helper.elt("ul");

						dataType[type].map(function(fullname){
							return [ dataLabel[fullname],fullname];
						}).sort().forEach(function (item){
							// name
							var fullname = item[1],
								datasetNode = dom_helper.elt("li", dom_helper.hrefLink(dataLabel[fullname], "?dataset=" + dataName[fullname] + "&host=" + dataHost[fullname]));

							if (dataStatus[fullname] === session.GOODSTATUS && !dataWarning[fullname]) { // perfect data show sampleN
								datasetNode.appendChild(dom_helper.valueNode(fullname + "sampleN"));
								xenaQuery.dataset_samples(dataHost[fullname], dataName[fullname]).subscribe(function (s) {
									document.getElementById(fullname + "sampleN").
									appendChild(dom_helper.elt("label", document.createTextNode(" (n=" + s.length.toLocaleString() + ")")));
								});
							} else if (dataStatus[fullname] === session.GOODSTATUS && dataWarning[fullname]){ // show loader warning
								tmpNode = dom_helper.hrefLink(" ["+ dataStatus[fullname]+" with warning] ","#");
								warningPopUp (tmpNode, dataWarning[fullname]);
								datasetNode.appendChild(tmpNode);
							} else if (dataStatus[fullname] === "error") {  // show error status
								tmpNode = dom_helper.elt("span"," ["+dataStatus[fullname]+"] ");
								tmpNode.style.color="red";
								datasetNode.appendChild(tmpNode);
							} else {
								datasetNode.appendChild(document.createTextNode(" ["+dataStatus[fullname]+"] "));
							}

							// host
							tmpNode = dom_helper.hrefLink(dataHost[fullname], "?host=" + dataHost[fullname]);
							tmpNode.setAttribute("id", "status" + dataHost[fullname]);
							datasetNode.appendChild(tmpNode);
							session.updateHostStatus(dataHost[fullname]);

							// delete and reload button
							var deletebutton = deleteDataButton (dataCollection[fullname]);
							if(deletebutton) {
								datasetNode.appendChild(deletebutton);
							}

							//dataset description
							if (dataDescription[fullname]) {
								var descriptionNode = dom_helper.elt("div");
								descriptionNode.setAttribute("class", "line-clamp");
								descriptionNode.appendChild(dom_helper.elt("summary", dom_helper.stripHTML(dataDescription[fullname])));

								datasetNode.appendChild(descriptionNode);
							}
							listNode.appendChild(datasetNode);
						});
						nodeDataType.appendChild(listNode);
					});

					rootNode.appendChild(nodeDataType);

					// samples section
					var sampleNode = dom_helper.sectionNode("dataType");
					rootNode.appendChild(sampleNode);

					xenaQuery.all_samples(_.uniq(_.values(dataHost))[0], cohortName).subscribe(
						function (s) {
							sampleNode.appendChild(dom_helper.elt("header", s.length + " samples"));
							listNode = dom_helper.elt("ul");
							sampleNode.appendChild(listNode);
							sampleNode.appendChild(dom_helper.elt("br"));

							s.forEach(function (sample) {
								listNode.appendChild(dom_helper.elt(
									"li", dom_helper.hrefLink(sample, "?sample=" + sample + "&cohort=" + cohortName)));
							});
						});
			});
		});
	}

	// build single DATASET page
	function datasetPage(dataset, host, baseNode) {
		// collection
		var name = dataset.name,
				label = dataset.label || name,
				description = dataset.description,
				longTitle = dataset.longTitle,
				cohort = dataset.cohort || COHORT_NULL,
				dataType = dataset.dataSubType,
				platform = dataset.platform,
				assembly = dataset.assembly,
				version = dataset.version,
				url = dataset.url,
				articletitle = dataset.articletitle,
				citation = dataset.citation,
				pmid = dataset.pmid,
				author = dataset.author,
				wrangling_procedure = dataset.wrangling_procedure,
				type = dataset.type || TYPE_NULL,
				urls,
				link, metalink,
				status = dataset.status,
				loaderWarning = dataset.loader,
				probeMap = dataset.probeMap,
				goodStatus = session.GOODSTATUS,
				nodeTitle, vizbuttonParent, hostNode, tmpNode;


		if (description) {
			description = dom_helper.stripScripts(description);
		}

		if (wrangling_procedure) {
			wrangling_procedure = dom_helper.stripScripts(wrangling_procedure);
		}

		if (url) {
			urls = _.uniq(url.split(","));
		}

		// layout
		var sectionNode = dom_helper.sectionNode("dataset");

		// dataset title
		sectionNode.appendChild(dom_helper.elt("h2", "dataset: "+label));
		sectionNode.appendChild(dom_helper.elt("br"));

		// long title
		if (longTitle) {
			sectionNode.appendChild(document.createTextNode(longTitle));
			sectionNode.appendChild(dom_helper.elt("br"));
		}

		//description
		if (description) {
			sectionNode.appendChild(dom_helper.elt("br"));

			tmpNode = dom_helper.elt("result2");
			tmpNode.innerHTML = description;

			sectionNode.appendChild(tmpNode);
			sectionNode.appendChild(dom_helper.elt("br"));
		}

		// cohort:xxx
		sectionNode.appendChild(dom_helper.elt("labelsameLength","cohort"));
		nodeTitle = dom_helper.hrefLink(cohort, "?cohort=" + encodeURIComponent(cohort));
		vizbuttonParent = dom_helper.elt("multiple", nodeTitle);
		sectionNode.appendChild(dom_helper.elt("resultsameLength", vizbuttonParent));

		// viz button
		if (status === goodStatus){
			cohortHeatmapButton(cohort,
				_.intersection( _.intersection(activeHosts, userHosts), [host]),
				vizbuttonParent);
		}
		sectionNode.appendChild(dom_helper.elt("br"));

		// ID
		sectionNode.appendChild(dom_helper.elt("labelsameLength","dataset ID"));
		sectionNode.appendChild(dom_helper.elt("resultsameLength", name));
		sectionNode.appendChild(dom_helper.elt("br"));


		// status and loader warning
		if (status===goodStatus && !loaderWarning){ // perfect data
		} else if (status===goodStatus && loaderWarning){ // loaded with warning
			tmpNode = dom_helper.hrefLink(status+" with warning","#");
			warningPopUp (tmpNode, loaderWarning);
			sectionNode.appendChild(dom_helper.elt("labelsameLength","status"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", tmpNode));
			sectionNode.appendChild(dom_helper.elt("br"));
		} else if (status === "error") { // error
			tmpNode = dom_helper.elt("span",status);
			tmpNode.style.color="red";
			sectionNode.appendChild(dom_helper.elt("labelsameLength","status"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", tmpNode));
			sectionNode.appendChild(dom_helper.elt("br"));
		}
		else {
			tmpNode = dom_helper.elt("span", status);
			tmpNode.style.color="blue";
			sectionNode.appendChild(dom_helper.elt("labelsameLength","status"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", tmpNode));
			sectionNode.appendChild(dom_helper.elt("br"));
		}

		// Downlaod
		if (host === "https://genome-cancer.ucsc.edu:443/proj/public/xena") {
			sectionNode.appendChild(dom_helper.elt("labelsameLength","download"));
			var array = name.split("/");
			link = "https://genome-cancer.ucsc.edu/download/public/xena/" + array.slice(1, array.length).join("/");
			metalink = "https://genome-cancer.ucsc.edu/download/public/xena/" + array.slice(1, array.length).join("/")+".json";

			sectionNode.appendChild(dom_helper.elt("resultsameLength",
				dom_helper.hrefLink(link, link),
				document.createTextNode("; "),
				dom_helper.hrefLink("Metadata", metalink)));

			sectionNode.appendChild(dom_helper.elt("br"));
		}

		// samples: n
		sectionNode.appendChild(dom_helper.elt("labelsameLength", "samples"));
		sectionNode.appendChild(dom_helper.valueNode(dataset+"SampleN"));
		dom_helper.updataDOM_xenaDataSet_sampleN(dataset + "SampleN", host, name);
		sectionNode.appendChild(dom_helper.elt("br"));

		// update on: xxx
		if (version) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength","version"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", version));
			sectionNode.appendChild(dom_helper.elt("br"));
		}
		//  host: host
		sectionNode.appendChild(dom_helper.elt("labelsameLength","host"));
		hostNode = dom_helper.elt("resultsameLength", dom_helper.hrefLink(host, "?host=" + host));
		hostNode.setAttribute("id", "status" + host);
		sectionNode.appendChild(hostNode);
		session.updateHostStatus(host);
		sectionNode.appendChild(dom_helper.elt("br"));

		// type of data
		if (dataType) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength","type of data"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", dataType));
			sectionNode.appendChild(dom_helper.elt("br"));
		}

		// assembly
		if (assembly) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength","assembly"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", assembly));
			sectionNode.appendChild(dom_helper.elt("br"));
		}
		//platform
		if (platform) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength","platform"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", platform));
			sectionNode.appendChild(dom_helper.elt("br"));
		}
		//probeMap
		if (probeMap) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength","ID/Gene mapping"));
			if (host === "https://genome-cancer.ucsc.edu:443/proj/public/xena") {
				link = "https://genome-cancer.ucsc.edu/download/public/xena/" + probeMap.replace(/^public\//,"");
				metalink = "https://genome-cancer.ucsc.edu/download/public/xena/" + probeMap.replace(/^public\//,"")+".json";
				sectionNode.appendChild(dom_helper.elt("resultsameLength",
					dom_helper.hrefLink(probeMap, link),
					document.createTextNode("; "),
					dom_helper.hrefLink("Metadata", metalink)));
			}
			else {
				sectionNode.appendChild(dom_helper.elt("resultsameLength", probeMap));
			}
			sectionNode.appendChild(dom_helper.elt("br"));
		}

		if (articletitle) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength", "publication"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", articletitle));
			sectionNode.appendChild(dom_helper.elt("br"));
		}
		if (citation) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength", "citation"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", citation));
			sectionNode.appendChild(dom_helper.elt("br"));
		}
		if (author) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength", "author"));
			sectionNode.appendChild(dom_helper.elt("resultsameLength", author));
			sectionNode.appendChild(dom_helper.elt("br"));
		}
		if (pmid && (typeof pmid) === "number") {
			sectionNode.appendChild(dom_helper.elt("labelsameLength", "PMID"));
			sectionNode.appendChild(
				dom_helper.elt("resultsameLength", dom_helper.hrefLink(
					pmid.toString(), "http://www.ncbi.nlm.nih.gov/pubmed/?term=" + pmid.toString())));
			sectionNode.appendChild(dom_helper.elt("br"));
		}
		if (urls) {
			urls.forEach(function (url) {
				sectionNode.appendChild(dom_helper.elt("labelsameLength", "raw data"));
				sectionNode.appendChild(dom_helper.elt("resultsameLength", dom_helper.hrefLink(url, url)));
				sectionNode.appendChild(dom_helper.elt("br"));
			});
		}

		if (wrangling_procedure) {
			sectionNode.appendChild(dom_helper.elt("labelsameLength", "wrangling"));

			tmpNode = dom_helper.elt("resultsameLength");
			tmpNode.innerHTML = wrangling_procedure;

			sectionNode.appendChild(tmpNode);
			sectionNode.appendChild(dom_helper.elt("br"));
		}

		// input file format
		sectionNode.appendChild(dom_helper.elt("labelsameLength","input data format"));
		sectionNode.appendChild(dom_helper.elt("resultsameLength",FORMAT_MAPPING[type]));
		sectionNode.appendChild(dom_helper.elt("br"));
		baseNode.appendChild(sectionNode);

		if (status !== goodStatus){
			baseNode.appendChild(sectionNode);
			return;
		}

		sectionNode.appendChild(dom_helper.elt("br"));
		// dimentions
		var oldNode = dom_helper.elt("span"),
			spaceHolderNode = dom_helper.elt("span"),
			node =  dom_helper.elt("span"),
			node2 = dom_helper.elt("span");

		sectionNode.appendChild(oldNode);
		sectionNode.appendChild(dom_helper.elt("br"));

		if (type === "genomicMatrix") {
			//identifiers count
			spaceHolderNode.appendChild(node2);
			spaceHolderNode.appendChild(document.createTextNode(" x "));
			// samples: n
			spaceHolderNode.appendChild(node);
		} else if (type === "clinicalMatrix") {
			// samples: n
			spaceHolderNode.appendChild(node);
			spaceHolderNode.appendChild(document.createTextNode(" x "));
			//identifiers count
			spaceHolderNode.appendChild(node2);
		} else if (type === "mutationVector") {
			// samples: n
			spaceHolderNode.appendChild(node);
			node2= undefined;
		}

		xenaQuery.dataset_samples(host, name).subscribe(function (s) {
			node.innerHTML= s.length.toLocaleString()+" samples";

			xenaQuery.dataset_field(host, name).subscribe(function(probes){
				if (node2) {
					node2.innerHTML = probes.length.toLocaleString() +" identifiers";
				}
				sectionNode.replaceChild(spaceHolderNode, oldNode);

				tmpNode =dom_helper.elt("a","Show More Data Snippets");
				tmpNode.setAttribute("class","textLink");
				addMoreDataLink(dataset,probes.length,tmpNode);
				spaceHolderNode.appendChild(tmpNode);

				tmpNode =dom_helper.elt("a","Show All Identifiers");
				tmpNode.setAttribute("class","textLink");
				addAllIdLink(dataset, tmpNode);
				spaceHolderNode.appendChild(tmpNode);
			});
		});

		tmpNode = dom_helper.tableCreate(11,11);
		sectionNode.appendChild(tmpNode);
		sectionNode.appendChild(dom_helper.elt("br"));

		dataSnippets(dataset, 10, 10, tmpNode);

		baseNode.appendChild(sectionNode);
	}

	function allIdentifiersPage (query_string){
		var host = query_string.host,
			datasetname = query_string.dataset,
			label = query_string.label,
			textNode, text,
			rootNode = dom_helper.sectionNode("bigDataSnippet");

		document.body.appendChild(rootNode);
		rootNode.appendChild(dom_helper.elt("h3","dataset: "+label));
		textNode = document.createElement("pre");
		rootNode.appendChild(textNode);

		text="Identifiers\n";
		xenaQuery.dataset_field(host, datasetname).subscribe(function(probes){
			probes.forEach(function(probe){
				text = text +probe.name+"\n";
			});
			textNode.innerHTML=text;
		});
	}

	function addAllIdLink (dataset, linkNode){
		var name = JSON.parse(dataset.dsID).name,
			host= JSON.parse(dataset.dsID).host,
			label = dataset.label?dataset.label: name,
			link, qString,
			qStringObj ={};

		qStringObj.host = host;
		qStringObj.dataset = name;
		qStringObj.label = label;
		qStringObj.allIds = true;

		qString= dom_helper.JSONToqueryString(qStringObj);
		link = "../datapages/?"+qString;
		linkNode.setAttribute("href", link);
	}

	function addMoreDataLink (dataset, probesLength, linkNode){
		var name = JSON.parse(dataset.dsID).name,
			host= JSON.parse(dataset.dsID).host,
			format = dataset.type,
			qString,
			qStringObj = {
				"host": host,
				"dataset": name,
				"nSamples": 10,
				"nProbes": probesLength
			},
			link;

		if (format==="mutationVector" ){
			qStringObj.nProbes = 1000;
		}
		if (format==="genomicMatrix" ){
			qStringObj.nProbes = 1000;
		}
		if (format === "clinicalMatrix") {
			qStringObj.nSamples= 500;
		}
		qString= dom_helper.JSONToqueryString(qStringObj);
		link = "../datapages/?"+qString;
		linkNode.setAttribute("href", link);
	}

	function dataSnippets (dataset, nSamples, nProbes, node){
		var table,
			host = JSON.parse(dataset.dsID).host,
			name = dataset.name,
			type = dataset.type,
			allSamples, allProbes;


		if ((type === "genomicMatrix")  || (type ==="clinicalMatrix")) {
			//data snippet samples, probes
			xenaQuery.dataset_samples(host, name).subscribe(
				function (samples) {
					allSamples = samples.length;
					samples= samples.slice(0, nSamples);

					var query = xenaQuery.dataset_field(host, name);

					query.subscribe(function (s) {
						allProbes = s.map(function (probe) {
							return probe.name;
						});
						var probes = allProbes.slice(0, nProbes);
						allProbes = allProbes.length;

						xenaQuery.code_list(host, name, probes).subscribe(function(codemap){
							//return probes by all_samples
							var row, column,
									dataRow, dataCol,
									i,j,text,
									firstRow, firstCol;

							xenaQuery.dataset_probe_values(host, name, samples, probes).subscribe( function (s) {
								if (type==="genomicMatrix"){
									firstCol = probes;
									firstRow = samples;
								} else {
									firstCol = samples;
									firstRow = probes;
								}

								column = firstRow.length;
								row = firstCol.length;

								table = dom_helper.tableCreate(row+1, column+1);

								node.parentNode.replaceChild(table,node);

								if (type==="genomicMatrix"){
									dataCol = (column>=allSamples) ? column: nSamples-1;    //sample
									dataRow = (row >=allProbes)? row: nProbes-1; //probe
								} else if (type==="clinicalMatrix"){
									dataCol = (column >=allProbes)? column:nProbes-1; //probe
									dataRow = (row>=allSamples) ? row: nSamples-1; //sample
								}

								//first row -- labels
								text ="\t";
								for (j=1; j< dataCol+1; j++){
									dom_helper.setTableCellValue (table, 0, j, firstRow[j-1]);
								}

								//first col
								for (i=1; i< dataRow+1; i++){
									dom_helper.setTableCellValue (table, i, 0, firstCol[i-1]);
								}

								//data cell
								for(i = 1; i < s.length+1; i++){
									var probe = probes[i-1],
										value, code;

									text = firstCol[i-1];
									for (j=1; j< samples.length+1; j++){
										if (type==="genomicMatrix"){
											value = s[i-1][j-1];
										} else {
											value = s[i-1][j-1];
										}
										code = undefined;
										if (codemap[probe]) {
											if(!isNaN(value)){
												code = codemap[probe][value];
											}
										}

										if ((type==="genomicMatrix") && (i<dataRow+1) && (j<dataCol+1)) {
											dom_helper.setTableCellValue (table, i, j, code? code:value);
										} else if ((type==="clinicalMatrix") && (j<dataRow+1) && (i<dataCol+1)) {
											dom_helper.setTableCellValue (table, j, i, code? code:value);
										}
									}
								}
								dom_helper.setTableCellValue (table, 0, 0, " ");
							});
						});
					});
				});
			}
		else if(type ==="mutationVector"){
			xenaQuery.sparse_data_examples(host, name, nProbes).subscribe( function(s){
				if (s.rows && s.rows.length>0) {
					var i, j, key,
						keys = Object.keys(s.rows[0]),
						column = keys.length,
						row = s.rows.length,
						dataRow = (row<nProbes) ? row:nProbes-1; //recored

					// put chrom chromstart chromend together to be more readable
					keys.sort();
					var start = keys.indexOf("chromstart"),
						end = keys.indexOf("chromend"),
						keysP={};
					keys[start]="chromend";
					keys[end]="chromstart";

					table = dom_helper.tableCreate(row+1, column+1);
					node.parentNode.replaceChild(table,node);

					//first row -- labels
					for (j=1; j<keys.length+1; j++){
						dom_helper.setTableCellValue (table, 0, j, keys[j-1]);
						keysP[keys[j-1]]=j;
					}

					//data cell
					for(i = 1; i < dataRow+1; i++){
						for (key in s.rows[i-1]) {
							if (s.rows[i - 1].hasOwnProperty(key)) {
								j = keysP[key];
								dom_helper.setTableCellValue (table, i, j, s.rows[i-1][key]);
								//first column
								if (key ==="sampleid"){
									dom_helper.setTableCellValue (table, i, 0, s.rows[i-1][key]);
								}
							}
						}
					}
					dom_helper.setTableCellValue (table, 0, 0, " ");
				}
			});
		}
	}

	// build single SAMPLE page
	function samplePage(sample, cohort) {
		// layout
		var sectionNode = dom_helper.sectionNode("dataset");

		// sample title
		sectionNode.appendChild(dom_helper.elt("h2", "sample: "+sample));
		sectionNode.appendChild(dom_helper.elt("label", "cohort:"));
		sectionNode.appendChild(dom_helper.elt("result", dom_helper.hrefLink(cohort, "?&cohort=" + cohort)));

		baseNode.appendChild(sectionNode);
	}

	// sidebar current hub list with checkboxes
	function hubSideBar(hosts) {
			//checkbox sidebar
		var sideNode = dom_helper.elt("div");
		sideNode.setAttribute("id", "sidebar");

		var checkNode = dom_helper.sectionNode("sidehub");

		checkNode.appendChild(dom_helper.elt("h3", dom_helper.hrefLink("Current Data Hubs", "../hub/")));
		checkNode.appendChild(dom_helper.elt("br"));


		allHosts.forEach(function (host) {
			if (hosts.indexOf(host)!==-1) {
				session.updateHostStatus(host);
				var checkbox = session.metaDataFilterCheckBox(host);
				var tmpNode = dom_helper.elt("result2",
					dom_helper.hrefLink(host + " (connecting)", "../datapages/?host=" + host));
				tmpNode.setAttribute("id", "status" + host);
				checkNode.appendChild(dom_helper.elt("h4", checkbox, " ", tmpNode));
				checkNode.appendChild(dom_helper.elt("br"));
			}
		});
		sideNode.appendChild(checkNode);

		//apply button
		var applybutton = document.createElement("BUTTON");
			applybutton.setAttribute("class","vizbutton");
			applybutton.appendChild(document.createTextNode("Apply"));
			applybutton.addEventListener("click", function() {
  			location.reload();
			});
		sideNode.appendChild(applybutton);

		return sideNode;
	}

	// sidebar datasets action
	function datasetSideBar(dataset, sideNode) {
		// delete button
		var button = deleteDataButton (dataset);
		if (button) {
			sideNode.appendChild(button);
			sideNode.appendChild(document.createElement("br"));
		}
	}

	function bigDataSnippetPage (query_string){
		var host = query_string.host,
			dataset = query_string.dataset,
			nSamples = parseFloat(query_string.nSamples),
			nProbes = parseFloat(query_string.nProbes),
			blockNode = dom_helper.elt("span", "If you are reading this, you need release browser SHIELD to see the data requested"),
			rootNode = dom_helper.sectionNode("bigDataSnippet"),
			node = document.createElement("div");

		document.title= dataset;
		document.body.appendChild(rootNode);
		rootNode.appendChild(node);
		node.appendChild( dom_helper.elt("h3","dataset: "+dataset));
		node.appendChild( blockNode );
		blockNode.style.color="red";

		xenaQuery.dataset_by_name(host, dataset).subscribe(
			function (datasets) {
				var label = datasets[0].label? datasets[0].label : datasets[0].name;

				document.title=label;
				blockNode.parentNode.replaceChild(dom_helper.elt("div","Querying xena on "+ host+" ... "),blockNode);
				dataSnippets(datasets[0], nSamples, nProbes, node);
			}
		);
	}


	// if there is no url query string, query xena find the cohorts on main server
	var host, dataset, cohort;

	// ?host=id
	if (Object.keys(query_string).length===1 && query_string.host) {
		host = query_string.host;

		if (allHosts.indexOf(host) === -1) {
		    return;
		}

		// host title
		var node=dom_helper.sectionNode("cohort");

		var tmpNode = dom_helper.hrefLink(host + " (connecting)", "../datapages/?host=" + host);
		tmpNode.setAttribute("id", "status" + host);
		node.appendChild(dom_helper.elt("h2", tmpNode));
		session.updateHostStatus(host);
		baseNode.appendChild(node);

		// cohort list
		cohortListPage([host], baseNode);
	}

	// ?dataset=id & host=id
	else if (Object.keys(query_string).length===2 && query_string.host && query_string.dataset) {
		dataset = query_string.dataset;
		host = query_string.host;

		container = dom_helper.elt("div");
		container.setAttribute("id", "content-container");

		sideNode = dom_helper.elt("div");
		sideNode.setAttribute("id", "sidebar");
		container.appendChild(sideNode);

		//main section dataset detail page
		mainNode = dom_helper.elt("div");
		mainNode.setAttribute("id", "dataPagesMain");
		container.appendChild(mainNode);

		baseNode.appendChild(container);

		xenaQuery.dataset_by_name(host, dataset).subscribe(
			function (s) {
				if (s.length) {
					//dataset sidebar
					datasetSideBar(s[0],sideNode);
					datasetPage(s[0], host, mainNode);
				}
			}
		);
	}

	// ?sample=id&cohort=id
	else if ( Object.keys(query_string).length===2 && query_string.cohort && query_string.sample) {
		var sample = query_string.sample;
		cohort = decodeURIComponent(query_string.cohort);
		ifCohortExistDo(cohort, activeHosts, undefined, function() {
			samplePage(sample, cohort);
		});
	}

	// ?cohort=id
	else if (Object.keys(query_string).length ===1 && query_string.cohort) {
		cohort = query_string.cohort;

		container = dom_helper.elt("div");
		container.setAttribute("id", "content-container");

		//sidebar
		//sideNode = hubSideBar(userHosts);
		sideNode = hubSideBar(activeHosts);
		container.appendChild(sideNode);

		//main section cohort list page
		mainNode = dom_helper.elt("div");
		mainNode.setAttribute("id", "dataPagesMain");

		cohortPage(cohort, _.intersection(activeHosts, metadataFilterHosts), mainNode);
		container.appendChild(mainNode);

		container.appendChild(dom_helper.elt("br"));
		baseNode.appendChild(container);
	}

	// large data snippet
	else if (Object.keys(query_string).length ===4 && query_string.host && query_string.dataset &&
			query_string.nSamples && query_string.nProbes) {
		bigDataSnippetPage (query_string);
	}

	// all identifiers from a dataset
	else if (Object.keys(query_string).length ===4 && query_string.host && query_string.dataset &&
			query_string.label && query_string.allIds) {
		allIdentifiersPage (query_string);
	}

	// cohort list
	else {
		container = dom_helper.elt("div");
		container.setAttribute("id", "content-container");

		//sidebar
		//sideNode = hubSideBar(userHosts);
		sideNode = hubSideBar(activeHosts);
		container.appendChild(sideNode);

		//main section cohort list page
		mainNode = dom_helper.elt("div");
		mainNode.setAttribute("id", "dataPagesMain");
		cohortListPage(_.intersection(_.intersection(activeHosts/*, userHosts*/), metadataFilterHosts), mainNode);
		container.appendChild(mainNode);

		container.appendChild(dom_helper.elt("br"));
		baseNode.appendChild(container);
	}
});
