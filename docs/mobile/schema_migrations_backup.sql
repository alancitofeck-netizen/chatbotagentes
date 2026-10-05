-- Backup del registro supabase_migrations.schema_migrations de PRODUCCIÓN
-- (proyecto hfcagkwqefilifprthau), tomado antes del repair de migraciones.
-- Fecha: 2026-10-05. 112 filas.
--
-- Qué guarda: version, name y un md5 del contenido de "statements" de cada fila,
-- para verificar después que el registro original quedó intacto.
-- NO guarda el texto completo de "statements" (~206 KB): el dump de la CLI
-- (supabase db dump) necesita Docker, que no está instalado en esta máquina.
-- Si hace falta el texto completo, se puede exportar con pg_dump desde un
-- entorno con Docker o con el panel de Supabase antes de volver a tocar el registro.
--
-- Restaurar (solo si hiciera falta revertir el repair, y sin los statements):
--   delete from supabase_migrations.schema_migrations;  -- ojo: borra todo
--   y luego ejecutar las líneas insert de abajo.
-- Las filas 20260901010000..20260901010003 (0180–0183) tienen statements vacíos
-- en producción (md5 = null): ya se registraron sin texto.

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260707042058', 'workspaces_and_members', null); -- statements md5=086692005f3d7275c50ad9ffc85c5783
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260708004654', 'crm_and_dashboard', null); -- statements md5=1cf211fb16ff2111dfb9a0b484d7ddc9
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260709013036', '0005_contacts_realtime', null); -- statements md5=fcc8ef230c0e07a3df12a43296135d20
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260709151304', 'crm_board_enrichment', null); -- statements md5=830409c2dde514a68d6af832f249bd08
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260709164514', 'advisors_module', null); -- statements md5=24ea4aa16498e7bca1504f0321e7c25d
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260711003905', 'integration_connections', null); -- statements md5=f45267443f0947bd176956fe1e5e670e
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260713021339', '0012_whatsapp_integration_vault', null); -- statements md5=22dba4b85cf29553e072e9c18a32b055
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260713021734', '0012b_whatsapp_integration_revoke_anon', null); -- statements md5=f347b5962c7e8a911ad2a4c693be12a1
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260713022110', '0012c_whatsapp_integration_optional_key', null); -- statements md5=d99d0ca510bffb93af964bdcb2515f95
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260713024434', '0013_whatsapp_credentials_lookup', null); -- statements md5=52f564224c47c64766a87e4338b58ddf
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260713031718', '0014_conversation_reads', null); -- statements md5=a339f6862de6b9584cd3a118e0c09c0b
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260713035740', '0015_get_my_sessions', null); -- statements md5=39220a23d7b939ce2bb34ec8f8d5aade
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260713042830', '0016_tasks_enrichment', null); -- statements md5=f6630ad774f7f00ac08491549d18c3cc
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260713052555', '0017_calendar_events', null); -- statements md5=469eabfdb877b00d3c645cf09895f049
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260713052644', '0018_calendar_oauth_credentials', null); -- statements md5=9dd3a1a36e141f9c1e3a56ea749de84c
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260713183003', 'documents_module', null); -- statements md5=25ec211ee0126d0833f1421349bd66ae
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260717004205', 'tags_update_policy', null); -- statements md5=44ec14ed4cdee9203209019507c60651
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260717004315', 'whatsapp_templates', null); -- statements md5=01bda95927c5ca8937d87ccaff5446b1
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260717162603', 'kpi_setter_sheets', null); -- statements md5=d54b5ea75c861f6ecb77c996770d1c41
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260726225534', '0050_whatsapp_web_sessions', null); -- statements md5=6740872da05a9493ba7f9ffa5f6f8b45
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260726225554', '0051_whatsapp_web_credentials', null); -- statements md5=7f7e8b80b90eaec4096802a0f830a3f9
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260726232203', '0050b_fix_gen_random_bytes_schema', null); -- statements md5=450991140afc761a55b55602588175e9
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260726232248', '0050c_fix_multiple_return_rows', null); -- statements md5=6a7d34958861b3e92d628c6b2268df21
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260726232533', '0050d_fix_vault_secret_name_collision', null); -- statements md5=8fca5d0a2dd17ae86f9777190c5784ed
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260726232613', '0050e_fix_ambiguous_session_id_reference', null); -- statements md5=dd3506bacd67b999bfa727cbfe84ceac
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260728041731', '0059_pgcron_import_processing_fix', null); -- statements md5=cddd738fa585dbbbab6fdc64e0fc4bd6
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260728044750', '0060_import_job_rows_contact_dedupe', null); -- statements md5=a5f7c0e7b26a3a1b0b54320976b38a04
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260728145107', 'mini_apps_module', null); -- statements md5=e0c57a4bb1052d642a411e73fe150008
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260728160510', 'mini_apps_public_pages', null); -- statements md5=19e678920ea8eab4f6b32345e73a39cd
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260730162126', 'classroom_module', null); -- statements md5=6564f4cebf3ac1fd6e0f1a43677f5936
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260730163018', 'classroom_comment_authors', null); -- statements md5=cbf43012c061487d91353014a7a10146
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260801215321', '0073_mini_apps_app_vinculada_template', null); -- statements md5=1295f5564ea745f213b8ecf7699634d8
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260801215322', '0074_insurance_prospects', null); -- statements md5=4f2cd29d1b3dbdc8f80202dc210c03fc
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260801215323', '0075_mini_app_bundles_storage', null); -- statements md5=ec1c53f7b2356c945dca8f26e70684bb
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260801225612', '0076_notifications_module', null); -- statements md5=b3635c00f7b981d9ef1edec449b17cbd
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260801225639', '0077_notifications_realtime', null); -- statements md5=64d2ff848fa47e4013546a469692f437
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260801232132', '0078_notifications_phase2_columns', null); -- statements md5=53ed9980deba6989c1ce3c051c17c7b5
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260801232149', '0079_notifications_phase2_functions', null); -- statements md5=6b7a1beadc05e0140ef4ccd638d5e668
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260801232215', '0080_notifications_phase2_cron', null); -- statements md5=f42034a1483b5a03bfd63915d5914a64
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260801233301', '0081_notification_preferences', null); -- statements md5=fe5edec6a051fd4b2c69bf71e580979e
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260802023725', '0082_lead_sheet_sync', null); -- statements md5=b1151253424dabc4d66c421e4ea570bb
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260802023739', '0083_lead_sheet_sync_claim', null); -- statements md5=8cbfac083982132d7197d0910de7dc58
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260802023751', '0084_lead_sheet_sync_cron', null); -- statements md5=a5d7a34e4acc104da88b6a0259b6a1cd
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260802032118', '0085_lead_sheet_sync_history', null); -- statements md5=3e75a65a1b5cde989b9a2a75c26941bf
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260804014413', 'whatsapp_web_chat_id', null); -- statements md5=411176fd2e4019486aff8d9040542708
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260804025514', 'merge_contacts', null); -- statements md5=a49e93872102212eb40b6a186339b4d5
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260804042717', 'policies_module', null); -- statements md5=403293acad9bfdef39247d2b152d801c
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260804042810', 'policies_module_key', null); -- statements md5=4cac98dfac8104f960f333055b09cc09
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260805005124', '0090_pipelines_policies_module_key', null); -- statements md5=d92a2585bca6a9af4e8499d94827ed1c
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260805005129', '0091_pipeline_items_policy_type', null); -- statements md5=ec9a22a45e024b7aa732aed7794c5ec9
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260805010730', '0092_policy_automations', null); -- statements md5=3ff1d40eb17349d8317c2d1f61148695
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260805010809', '0093_notifications_polizas_category', null); -- statements md5=422fbb6b73563fb8fc4209ccabcc59e2
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260805011023', '0094_pgcron_policy_automations', null); -- statements md5=15e94751c1c6b1e48b24685ee688f957
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260805011820', '0095_documents_category', null); -- statements md5=7a91c11eaed6cf584e809c3c453c6ac6
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260805012534', '0096_policies_source_import', null); -- statements md5=24dbabb5314f5fa0a744a5ac2af6e87a
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260805015406', '0097_policy_payments', null); -- statements md5=c3d8ee517c631df537cb2635a50cedbb
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260805020052', '0098_policy_endorsements', null); -- statements md5=cad836ad39234dcf78cf3b3ae80d6861
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260805031926', '0099_advisory_sessions_module', null); -- statements md5=d229cdbbff29da0a8cfdf6e0550d25bb
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260805034945', '0100_collections_module', null); -- statements md5=58e42cf541ee9b6d7f1a2e0ba411be93
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260805035955', '0101_collections_automations', null); -- statements md5=4690ccd4295ee8a7d5b4d562ab7658cf
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260806153203', '0104_policy_extraction_module', null); -- statements md5=98374bfab50e1b99fe6dd58cc384ac5e
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260806163210', '0105_goals_module', null); -- statements md5=12eb0efc4bb11eaebc5e143165da266f
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260806174147', '0106_ai_assistant_module', null); -- statements md5=145f653e44d2e0ccf974bc22ee5afeb2
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260806231341', '0107_insurance_providers_module', null); -- statements md5=30750ba6cda9bdf5a3e48c505e037b4c
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260807015008', 'automations_module', null); -- statements md5=32bd16a010e24073f26e3e7bfb5e956e
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260807015342', 'pgcron_run_automations', null); -- statements md5=82040718fb35ae0a13cc85b42d8ef6fc
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260807021355', 'automation_catalog', null); -- statements md5=d4de8b478384ab20bdd28672bafb51e2
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260807031206', 'data_transfer_module', null); -- statements md5=f3e28d3651a1cba29f0ff8fdc9035fc5
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260807031310', 'data_transfer_module_backfill', null); -- statements md5=8544c56e92496fe1cb456f875803ffbd
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260807034703', 'dashboard_home_metrics', null); -- statements md5=d5a1ac3c8cb88729296cbcf8a4eec535
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260807172726', 'mini_apps_diagnostico_financiero_template', null); -- statements md5=e6d4e671cc64cc0952a51c70049b9c2f
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260808000136', 'asesoria_responses', null); -- statements md5=bc423f719d93525fe911bef97242902e
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260810040835', 'asesoria_master_template', null); -- statements md5=6cdc3defd086e3bceb99a1c69cda44d5
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260810042525', 'asesoria_master_template_per_advisor', null); -- statements md5=2ac0c576ea004897a9be946d89ad1ead
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260810183246', 'asesoria_template_images_storage', null); -- statements md5=f1b62d9b91ccc69e47feed8d2978649f
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260810200539', 'asesoria_referrals', null); -- statements md5=b5558c8fbf391339100657d634703cf4
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260810212522', 'asesorias_realtime_publication', null); -- statements md5=a5a79ee52f05030fec29a47c68dd06f0
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260811000808', 'workspace_theme', null); -- statements md5=01c839d132c6e138a6710206c29259b4
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260811152106', 'mini_apps_diagnostico_solidez_template', null); -- statements md5=993f8c4fd9fae71039cf8255fc3046f8
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260811233854', 'client_access_and_contract_payments', null); -- statements md5=3a6b820fda682383168d61abfb218777
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260812004443', 'bookings_fuente_campana_resultado', null); -- statements md5=2341c5f2fc68157e1981d4d173bf22ab
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260812010620', 'tasks_related_area', null); -- statements md5=2d48c47f530175e0fdb7c80141773e08
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260812014409', 'clients_link_real_workspace', null); -- statements md5=52957d00e5f6c865333446db6861a643
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260812151607', 'mini_apps_calculadora_ingresos_template', null); -- statements md5=889466410a94a1fa8f7931bfed606745
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260813025523', '0135_mini_apps_ahorro_fiscal_template', null); -- statements md5=884ea7d72699e7acdf6bc3278113e2d9
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260815020455', '0143_agency_workspace_admin_gate', null); -- statements md5=eb4c793ed21a4ca95dadde9f59f3978c
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260815021158', '0144_agency_workspace_fix_original_admin', null); -- statements md5=e4040c7f1d75b15d63ae6a6b4a31182e
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260815034139', '0145_unify_advisor_sheet_sync', null); -- statements md5=9ec41d6e9644bf10b3d5d8a3610c3958
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260815041240', '0146_advisor_sheet_header_row', null); -- statements md5=d3480aded0067b4c0f8c0a4cd37e11a1
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260815045116', '0147_agenda_appointments_setter_name', null); -- statements md5=449f704f0dfd1c3574c9afed77e720b3
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260817002311', '0148_operaciones_module', null); -- statements md5=197c47b05ba07f31c2dbc01976305f4f
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260817012040', '0149_agenda_appointments_notes', null); -- statements md5=124707c2f79f9cac778a0b9a5f4dab34
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260817015121', '0150_advisor_sheets_cron_15min', null); -- statements md5=00140814858a627c25f433264e38eb3f
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260817020428', '0151_advisor_sheets_cron_2h', null); -- statements md5=133572db373920ca723e6af02ca0c2a2
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260817031627', '0152_agency_access_by_user', null); -- statements md5=8d129b7ad5e00f6615a3056f151b77c9
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260817035853', 'agency_access_public_wrappers', null); -- statements md5=db9aec2110e5efb98e6512c5e0208230
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260818231817', 'advisor_sheet_connections_agent_write', null); -- statements md5=9aea0d3b501ade47913c674224378d9d
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260819003428', 'advisor_sheet_self_service', null); -- statements md5=fde3dd0e2a5ebd7e5772ee07a37c4fd8
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260826034032', 'update_appointment_tool', null); -- statements md5=921462a6b48e10b8029b909f50464a67
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260826040507', 'ai_agent_type', null); -- statements md5=15a63e5a23300d2047eaaee0a9a30ce3
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260831171419', 'manychat_integration', null); -- statements md5=22cd252f7a8226fb11834f9889663a69
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260831224829', '0177_manychat_module', null); -- statements md5=1952757ab6c6a5385c7d9786641b4afe
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260831233030', '0178_onboarding_learning', null); -- statements md5=15964ce3c36692d96f060708cc87263b
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260901005800', '0179_learning_progress_in_progress_status', null); -- statements md5=94c6ac3bafb2d293c93bdc8db1c6fd6e
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260901010000', '0180_mini_app_privacy', null); -- statements md5=null
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260901010001', '0181_mini_app_content_calendar', null); -- statements md5=null
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260901010002', '0182_seed_sujey_content_calendar', null); -- statements md5=null
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260901010003', '0183_fix_mini_app_rls_recursion', null); -- statements md5=null
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260927234103', '0185_mini_app_leads_delete', null); -- statements md5=57d4b39eed6e03889718bc240169fb7b
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260928002415', '0186_mini_app_events', null); -- statements md5=9e26fd0e8a52e28327ada188aafe7f74
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260928002424', '0187_mini_app_leads_stages', null); -- statements md5=57332861bc35c935c1fca6234bd31059
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20260928004347', '0188_mini_app_leads_policy_link', null); -- statements md5=617975ff1dce68235516bafcc8d2a69d
