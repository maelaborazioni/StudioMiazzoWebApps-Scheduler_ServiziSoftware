/**
 * @properties={typeid:24,uuid:"5C32AA5A-5E79-4B55-8875-85B4D37DD727"}
 */
function bp_servizisoftware()
{
	var solutionName = 'Scheduler_ServiziSoftware';
	
	scopes.job.resetScheduler(solutionName);
}

/**
 * @properties={typeid:24,uuid:"70EA48F2-7919-4D9C-A71B-0DD2E80B5433"}
 */
function bp_modules_scheduler()
{
	plugins.scheduler.addCronJob('synchronize_modules_scheduler',
        '0 0,30 6,8,9,10,11,12,13,14,15,16,17,18,20 ? * MON-SAT',
		 bp_sincronizza_servizi_software,
		 globals.TODAY,
		 null,
		 ['args_1','args_2']);

}

/**
 * @properties={typeid:24,uuid:"D32096F7-A63A-4878-9E98-F6360CE26F49"}
 */
function prova_script()
{
	var newDate = new Date();
	application.output('Prova script Scheduler is running, last step at : ' + newDate.getHours() + 
		               ':' + newDate.getMinutes() + ':' + newDate.getSeconds(),
					   LOGGINGLEVEL.ERROR);
}

/**
 * @properties={typeid:24,uuid:"FD662723-ADAD-480F-939A-A9A7865EFB6D"}
 * @AllowToRunInFind
 */
function bp_sincronizza_servizi_software()
{
	scopes.job.writeJobInfo('Synchronize modules job started');
	
	try
	{
		// otteniamo i nomi dei databases clienti esistenti 
		var sqlDbCliente = "SELECT name FROM sys.databases WHERE name LIKE 'Cliente_%'";
		var dsDbCliente = databaseManager.getDataSetByQuery(globals.Server.MA_ANAGRAFICHE,sqlDbCliente,null,-1);
		var dsDbClienteSize = dsDbCliente.getMaxRowIndex();
		
		// per ogni database cliente
		for(var dbc = 1; dbc <= dsDbClienteSize; dbc++)
		{
			/** @type {String}*/
			var dbName = dsDbCliente.getValue(dbc,1);
			var ownerDbName = utils.stringMiddle(dbName,9,dbName.length);
		
			// troviamo il corrispondente "proprietario" nella tabella sec_owner del database
			// che ha associato il database avente il nome specificato
			/** @type{JSFoundset<db:/svy_framework/sec_owner>}*/
			var fsOwner = databaseManager.getFoundSet(globals.Server.SVY_FRAMEWORK,'sec_owner');
			if(fsOwner.find())
			{
				fsOwner.database_name = ownerDbName;
				var fsOwnerSize = fsOwner.search();
				
				if(fsOwnerSize)
				{
		            for(var ow = 1; ow <= fsOwnerSize; ow++)
		            {
		            	var currOwner = fsOwner.getRecord(ow);

		            	// trova le ditte presenti nel corrispondente database
						if(datasources.db[dbName.toLowerCase()])
						{
							/** @type {JSFoundset<db:/ma_anagrafiche/ditte>}*/
			            	var fsDitteCliente = databaseManager.getFoundSet(dbName,globals.Table.DITTE);
							if(fsDitteCliente.find())
							{
								fsDitteCliente.tipologia = [globals.Tipologia.STANDARD,globals.Tipologia.GESTITA_UTENTE];
								var fsDitteClienteSize = fsDitteCliente.search();
								if(fsDitteClienteSize == 0)
									continue;
								
								for(var dc = 1; dc <= fsDitteClienteSize; dc++)
								{
									var currDittaCliente = fsDitteCliente.getRecord(dc);
									var sqlModules = "SELECT [idDitta] \
													  ,[CodiceModulo] \
												      ,[CodiceSoftware] \
												      ,[Periodo_Dal] \
												      ,[Periodo_Al] \
												      FROM [V_Ditte_ModuliSoftware] \
												      WHERE idDitta = " + currDittaCliente.idcliente;
									var dsModules = databaseManager.getDataSetByQuery(globals.Server.MA_ANAGRAFICHE,sqlModules,[],-1)
									
									for(var dsm = 1; dsm <= dsModules.getMaxRowIndex(); dsm++)
									{
										var codiceModulo = dsModules.getValue(dsm,2);
										var codiceSoftware = dsModules.getValue(dsm,3);
										var periodoDal = dsModules.getValue(dsm,4);
										var periodoAl = dsModules.getValue(dsm,5);
										var dataInizioServizio = periodoDal ? globals.getFirstDatePeriodo(periodoDal) : null;
										var dataFineServizio = periodoAl ? globals.getLastDatePeriodo(periodoAl) : null;
									
										// codice per sincronizzazione (al netto di unificazione dei nomi dei servizi)											
										/** @type{JSFoundset<db:/svy_framework/sec_owner_in_module>}*/
										var fsOwnerModule = databaseManager.getFoundSet(globals.Server.SVY_FRAMEWORK,'sec_owner_in_module');
										if(fsOwnerModule.find())
										{
											fsOwnerModule.owner_id = currOwner.owner_id; // il modulo appartiene al proprietario
											fsOwnerModule.sec_owner_in_module_to_sec_module.name = codiceModulo; // il codice del modulo corrisponde al codice del servizio
										
											// se esiste già il corrispondente modulo verificane eventualmente le date di validità
											// ed il corrispondente codice del software
											if(fsOwnerModule.search())
											{
												if(fsOwnerModule.sw_name != codiceSoftware)
												{
													databaseManager.startTransaction();
													fsOwnerModule.sw_name = codiceSoftware;
													if(!databaseManager.commitTransaction())
													{
														databaseManager.rollbackTransaction();
														scopes.job.writeJobInfo('Synchronize modules - Update software modulo ' + codiceModulo + ' per il proprietario ' +
											                                     currOwner.name + ' non riuscito');
													}
												}
												
												if((fsOwnerModule.start_date == null || fsOwnerModule.start_date > dataInizioServizio) && dataInizioServizio != null)
												{
													databaseManager.startTransaction();
													fsOwnerModule.start_date = dataInizioServizio;
													if(!databaseManager.commitTransaction())
													{
														databaseManager.rollbackTransaction();
														scopes.job.writeJobInfo('Synchronize modules - Update data inizio validità modulo ' + codiceModulo + ' per il proprietario ' +
											                                     currOwner.name + ' non riuscito');
													}
												}
												
												if(fsOwnerModule.end_date != null && fsOwnerModule.end_date < dataFineServizio
														|| dataFineServizio == null)
												{
													databaseManager.startTransaction();
													fsOwnerModule.end_date = dataFineServizio;
													if(!databaseManager.commitTransaction())
													{
														databaseManager.rollbackTransaction();
														scopes.job.writeJobInfo('Synchronize modules - Update data fine validità modulo ' + codiceModulo + ' per il proprietario ' +
											                                     currOwner.name + ' non riuscito');
													}
												}
																								
											}
											else
											{
												// aggiungi il modulo per il proprietario impostandone le proprietà
												var recOwnerModuleIndex = fsOwnerModule.newRecord();
												if(recOwnerModuleIndex != -1)
												{
													var recOwnerModule = fsOwnerModule.getRecord(recOwnerModuleIndex);
													recOwnerModule.module_id = globals.getIdModuloProprietario(codiceModulo);
													recOwnerModule.owner_id = currOwner.owner_id;
													recOwnerModule.start_date = dataInizioServizio;
													recOwnerModule.end_date = dataFineServizio;
													recOwnerModule.sw_name = codiceSoftware;
													
													if(!databaseManager.saveData(recOwnerModule))
													{
														databaseManager.rollbackTransaction();
														scopes.job.writeJobInfo('Synchronize modules - Inserimento nuovo modulo ' + codiceModulo + ' per il proprietario ' +
											                                    currOwner.name + ' non riuscito');
													}
													else
														scopes.job.writeJobInfo('Synchronize modules - Inserimento modulo ' + codiceModulo + ' per il proprietario ' +
					                                                             currOwner.name + ' avvenuto' );
												}
											}
																						
										}
									}
//									// per ogni ditta verifica i servizi attivi su ma_anagrafiche interno
//									/** @type{JSFoundset<db:/ma_anagrafiche_generale/ditte_servizi>}*/
//									var fsDittaServizi = databaseManager.getFoundSet(globals.Server.MA_ANAGRAFICHE_GENERALE,globals.Table.DITTE_SERVIZI);
//									if(fsDittaServizi.find())
//									{
//										fsDittaServizi.idditta = currDittaCliente.idditta;
//										var fsDittaServiziSize = fsDittaServizi.getSize();
//										// per ogni servizio associato alla ditta 
//										for(var ds = 1; ds < fsDittaServiziSize; ds++)
//										{
//											var currDittaServizio = fsDittaServizi.getRecord(ds);
//											
//											// se il servizio non ammette la sezione software passa all'iterazione successiva
//											if(currDittaServizio.ditte_servizi_to_tab_servizi.sezione_software == 0)
//												continue;
//											
//											var codiceServizio = globals.getCodiceModulo(currDittaServizio.idtabservizio);
//											var dataInizioServizio = currDittaServizio.periodo_dal ? globals.getFirstDate(currDittaServizio.periodo_dal) : null;
//											var dataFineServizio = currDittaServizio.periodo_al ? globals.getLastDate(currDittaServizio.periodo_al) : null;
//                                            
//											scopes.job.writeJobInfo(codiceServizio + ' - valido dal periodo : ' + currDittaServizio.periodo_dal + ' al periodo ' + currDittaServizio.periodo_al);
//											
//                                            // codice per sincronizzazione (al netto di unificazione dei nomi dei servizi)											
//											/** @type{JSFoundset<db:/svy_framework/sec_owner_in_module>}*/
//											var fsOwnerModule = databaseManager.getFoundSet(globals.Server.SVY_FRAMEWORK,'sec_owner_in_module');
//											if(fsOwnerModule.find())
//											{
//												fsOwnerModule.owner_id = currOwner.owner_id; // il modulo appartiene al proprietario
//												fsOwnerModule.sec_owner_in_module_to_sec_module.name = codiceServizio; // il codice del modulo corrisponde al codice del servizio
//											
//												// se esiste già il corrispondente modulo verificane eventualmente le date di validità
//												if(fsOwnerModule.search())
//												{
//													if(fsOwnerModule.start_date != dataInizioServizio)
//													{
//														databaseManager.startTransaction();
//														fsOwnerModule.start_date = dataInizioServizio;
//														if(!databaseManager.commitTransaction())
//														{
//															databaseManager.rollbackTransaction();
////															application.output('Update data inizio validità modulo non riuscito');
//															scopes.job.writeJobInfo('Update data inizio modulo ' + codiceServizio + ' per il proprietario ' +
//												                                     currOwner.name + ' non riuscito');
//														}
//													}
//													
//													if(fsOwnerModule.end_date != dataFineServizio)
//													{
//														databaseManager.startTransaction();
//														fsOwnerModule.start_date = dataFineServizio;
//														if(!databaseManager.commitTransaction())
//														{
//															databaseManager.rollbackTransaction();
////															application.output('Update data fine validità modulo non riuscito');
//															scopes.job.writeJobInfo('Updata data fine validità modulo ' + codiceServizio + ' per il proprietario ' +
//												                                     currOwner.name + ' non riuscito');
//														}
//													}
//												}
//												else
//												{
//													// aggiungi il modulo per il proprietario impostandone le proprietà
//													var recOwnerModuleIndex = fsOwnerModule.newRecord();
//													if(recOwnerModuleIndex != -1)
//													{
//														var recOwnerModule = fsOwnerModule.getRecord(recOwnerModuleIndex);
//														recOwnerModule.module_id = globals.getIdModuloProprietario(codiceServizio);
//														recOwnerModule.owner_id = currOwner.owner_id;
//														recOwnerModule.start_date = dataInizioServizio;
//														recOwnerModule.end_date = dataFineServizio;
//														
//														if(!databaseManager.saveData(recOwnerModule))
//														{
//															databaseManager.rollbackTransaction();
////															application.output('Inserimento modulo ' + codiceServizio + ' per il proprietario ' +
////																               currOwner.name + ' non riuscito');
//															scopes.job.writeJobInfo('Inserimento modulo ' + codiceServizio + ' per il proprietario ' +
//												                                    currOwner.name + ' non riuscito');
//														}
//													}
//												}
//											}
//										
//										}
//									}
									
								}
							}
													
						}
		            }
				}
				else
				{
					scopes.job.writeJobInfo('No owners found...');
				}
			}
		}
	}
	catch (ex)
	{
		application.output(ex.message,LOGGINGLEVEL.ERROR);
	}
      
}