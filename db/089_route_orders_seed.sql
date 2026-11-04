-- Generated from DEMAND_SHEET 3-Nov EX RAIPUR 3 MFS SHEET.xlsm: its route tabs, Distributor Master and Tally mapping.

insert into route_order_route (name, sort) values
  ('Raipur 1', 1),
  ('Raipur 2', 2),
  ('Raipur 3', 3),
  ('Bhilai', 4),
  ('Bilaspur', 5),
  ('Raigarh', 6),
  ('Korba', 7),
  ('Mahasamund', 8),
  ('Rajnandgaon', 9),
  ('Jagdalpur', 10),
  ('Odisha', 11),
  ('Nagpur', 12),
  ('Other States', 13);

insert into route_order_series (fy, next_no) values ('26-27', 15112);

insert into route_order_product (sku_no, name, category, tally_item, tally_ledger, tally_unit, pack_size, gst_pct, shelf_days, weight_kg, stock_id, sort) values
  (1003, 'Gaia Toned Milk 500 ml', 'Milk', 'Gaia Doodh Toned 500ml- Pkt', 'Milk Sales', 'CRT', 24, 0, 2, 0.5, '1', 1),
  (999, 'Gaia Cow Milk 500 ml', 'Milk', 'Gaia Cow Milk 500 ML (Crt)', 'Milk Sales', 'CRT', 24, 0, 2, 0.5, '2', 2),
  (1042, 'Gaia Maxx UHT 110 ml', 'Milk', 'Gaia Maxx UHT 110ml', 'UHT Milk Sale', 'CBX', 30, 0, 90, 0.12, '3', 3),
  (1045, 'Gaia Maxx UHT 400 ml', 'Milk', 'Gaia Maxx UHT 400ml', 'UHT Milk Sale', 'CBX', 24, 0, 90, 0.4, '4', 4),
  (1050, 'Gaia Premium Milk UHT 1 L', 'Milk', 'Gaia Premium Milk UHT Tetra Pack 1 Ltr', 'UHT Milk Sale', 'CBX', 12, 0, 90, 1, '5', 5),
  (1051, 'Gaia Lite Milk UHT 1 L', 'Milk', 'Gaia Lite Milk UHT Tetra Pack 1Ltr', 'UHT Milk Sale', 'CBX', 12, 0, 90, 1, '6', 6),
  (1052, 'Gaia Gold Milk UHT 1 L', 'Milk', 'Gaia Gold Milk UHT Tetra Pack 1Ltr', 'UHT Milk Sale', 'CBX', 12, 0, 90, 1, '7', 7),
  (1044, 'Gaia Mishti Doi 80 g', 'Cup Dahi', 'Gaia Mishti Doi 80g', 'Dahi Sales', 'CBX', 12, 5, 5, 0.08, '16', 8),
  (1056, 'Gaia Dahi Cup 200 g Box (6 pc)', 'Cup Dahi', 'Gaia Dahi Cup 200 Gms Box(6Pc)', 'Dahi Sales', 'CBX', 6, 5, 5, 0.18, '14', 9),
  (1011, 'Gaia Dahi Cup 200 g', 'Cup Dahi', 'Gaia Dahi (Cup) 200 Gms', 'Dahi Sales', 'CBX', 12, 5, 5, 0.18, '15', 10),
  (1012, 'Gaia Dahi Pouch 200 g', 'Plain Dahi', 'Gaia Dahi (Crt) 200 Gms 60 Pkt', 'Dahi Sales', 'CRT', 60, 5, 5, 0.2, '8', 11),
  (1013, 'Gaia Dahi Pouch 400 g', 'Plain Dahi', 'Gaia Dahi 400 Gms (Crt) 30 Pkt', 'Dahi Sales', 'CRT', 30, 5, 5, 0.4, '9', 12),
  (1014, 'Gaia Dahi Pouch 1 kg', 'Plain Dahi', 'Gaia Dahi 1 Kg- 12 Packets', 'Dahi Sales', 'CRT', 12, 5, 5, 1, '10', 13),
  (1015, 'Gaia Dahi Pouch 5 kg', 'Plain Dahi', 'Gaia Dahi 5kg Pouch (2pcs)', 'Dahi Sales', 'CRT', 2, 5, 5, 5, '11', 14),
  (1047, 'Gaia Dahi Bucket 5 kg', 'Plain Dahi', 'Gaia Dahi Bucket 5 Kg', 'Dahi Sales', 'PCS', 1, 5, 5, 5, '12', 15),
  (1016, 'Gaia Dahi Bucket 15 kg', 'Plain Dahi', 'Gaia Dahi Bucket 15 Kg', 'Dahi Sales', 'PCS', 1, 5, 5, 15, '13', 16),
  (1017, 'Gaia Sweet Dahi Lychee 90 g', 'Flavoured Dahi', 'Gaia Premium Sweet Dahi (Lychee) Cup 90 Gms', 'Dahi Sales', 'CBX', 12, 5, 7, 0.09, '17', 17),
  (1018, 'Gaia Sweet Dahi Muskmelon 90 g', 'Flavoured Dahi', 'Gaia Premium Sweet Dahi (Muskmelon) Cup 90 Gms O', 'Dahi Sales', 'PCS', 1, 5, 7, 0.09, '18', 18),
  (1020, 'Gaia Kadhi Dahi Pouch 200 g', 'Kadhi Dahi', 'Gaia Kadhi Dahi (Crt) 200 Gm 60 Pkt', 'Dahi Sales', 'CRT', 60, 5, 5, 0.2, '19', 19),
  (1019, 'Gaia Kadhi Dahi Pouch 1 kg', 'Kadhi Dahi', 'Gaia Kadhi Dahi 1 Kg Crt (12 Pcs)', 'Dahi Sales', 'CRT', 12, 5, 5, 1, '20', 20),
  (1021, 'Gaia Kadhi Dahi Pouch 5 kg', 'Kadhi Dahi', 'Gaia Kadhi Dahi 5kg Pouch (2 Pcs)', 'Dahi Sales', 'CRT', 2, 5, 5, 5, '21', 21),
  (1022, 'Gaia Kadhi Dahi Bucket 15 kg', 'Kadhi Dahi', 'Gaia Kadhi Dahi Bucket 15 Kg', 'Dahi Sales', 'PCS', 1, 5, 5, 15, '23', 22),
  (1027, 'Gaia Masala Chaas Pouch 200 g', 'Lassi & Chaas', 'Gaia Masala Chaas 200 Grms', 'Chhach Sales', 'CRT', 60, 5, 3, 0.2, '54', 23),
  (1026, 'Gaia Sweet Lassi Pouch 180 ml', 'Lassi & Chaas', 'Gaia Sweet Lassi 180ml Pouch', 'Lassi Sales', 'CRT', 60, 5, 3, 0.18, '27', 24),
  (1023, 'Gaia Plain Lassi Glass 180 ml', 'Lassi & Chaas', 'Gaia Plain Lassi 180 Ml (Glass Cup 10)', 'Lassi Sales', 'CBX', 10, 5, 3, 0.18, '24', 25),
  (1024, 'Gaia Mango Lassi 180 ml', 'Lassi & Chaas', 'Mango Lassi 180 Ml - 10Pcs', 'Flavoured Lassi', 'CBX', 10, 5, 3, 0.18, '25', 26),
  (1025, 'Gaia Strawberry Lassi 180 ml', 'Lassi & Chaas', 'Strawberry Lassi 180 Ml - 10 Pcs', 'Flavoured Lassi', 'CBX', 10, 5, 3, 0.18, '28', 27),
  (1046, 'Gaia Masala Chaas Glass 180 ml', 'Lassi & Chaas', 'Gaia Masala Chaas Glass 180ml', 'Chhach Sales', 'CBX', 10, 5, 3, 0.18, '26', 28),
  (1005, 'Gaia Paneer 200 g', 'Paneer', 'Gaia Paneer 200gms', 'Gaia Paneer Sales', 'PCS', 1, 0, 5, 0.2, '29', 29),
  (1006, 'Gaia Paneer 500 g', 'Paneer', 'Gaia Paneer 500Gms', 'Gaia Paneer Sales', 'PCS', 1, 0, 5, 0.5, '30', 30),
  (1007, 'Gaia Paneer 1 kg', 'Paneer', 'Gaia Paneer 1kg', 'Gaia Paneer Sales', 'PCS', 1, 0, 5, 1, '31', 31),
  (1059, 'Gaia Low Fat Paneer 1 kg', 'Paneer', 'Gaia Low Fat Paneer 1kg', 'Gaia Paneer Sales', 'PCS', 1, 0, 5, 1, '55', 32),
  (1008, 'Loose Paneer 1 kg', 'Paneer', null, null, null, 1, 0, 5, 1, null, 33),
  (1009, 'Loose Paneer 5 kg', 'Paneer', 'Loose 5 Kg', 'Loose Paneer Sales', 'PCS', 1, 0, 5, 5, '33', 34),
  (1055, 'Gaia Desi Ghee 20 ml Pouch', 'Ghee', 'Gaia Premium Desi Ghee 20ml', 'Ghee Sales', 'CBX', 6, 5, 180, 1, '34', 35),
  (1028, 'Gaia Desi Ghee 100 ml', 'Ghee', null, null, null, 120, 5, 180, 0.1, null, 36),
  (1029, 'Gaia Desi Ghee 200 ml Jar', 'Ghee', 'Gaia Ghee 200 ML Jar', 'Ghee Sales', 'CBX', 90, 5, 180, 0.2, '35', 37),
  (1030, 'Gaia Desi Ghee 500 ml Jar', 'Ghee', 'Gaia Ghee 500 ML Jar', 'Ghee Sales', 'CBX', 36, 5, 180, 0.5, '36', 38),
  (1031, 'Gaia Desi Ghee 1 L Jar', 'Ghee', 'Gaia Ghee 1 Ltr Jar 18', 'Ghee Sales', 'CBX', 18, 5, 180, 1, '37', 39),
  (1038, 'Gaia Desi Ghee 1 L Ceka Pack', 'Ghee', 'Gaia Ghee Ceka Pack 1ltr', 'Ghee Sales', 'CBX', 18, 5, 180, 1, '38', 40),
  (1053, 'Gaia Desi Ghee 900 ml Ceka Pack', 'Ghee', 'Gaia Premium Desi Ghee Ceka Pack 900ml', 'Ghee Sales', 'CBX', 18, 5, 180, 0.9, '39', 41),
  (1032, 'Gaia Desi Ghee 5 L Jar', 'Ghee', 'Gaia Ghee 5 Ltr.Jar', 'Ghee Sales', 'CBX', 4, 5, 180, 5, '40', 42),
  (1033, 'Gaia Desi Ghee 15 kg Tin', 'Ghee', 'Gaia Ghee 15 Kilogram', 'Ghee Sales', 'PCS', 1, 5, 180, 15, '46', 43),
  (1039, 'Gaia Cow Ghee 200 ml Jar', 'Ghee', 'Gaia Cow Ghee 200 Ml Jar', 'Ghee Sales', 'CBX', 80, 5, 180, 0.2, '41', 44),
  (1040, 'Gaia Cow Ghee 500 ml Jar', 'Ghee', 'Gaia Cow Ghee 500 Ml Jar', 'Ghee Sales', 'CBX', 36, 5, 180, 0.5, '42', 45),
  (1041, 'Gaia Cow Ghee 1 L Jar', 'Ghee', 'Gaia Cow Ghee 1Ltr Jar', 'Ghee Sales', 'CBX', 18, 5, 180, 1, '43', 46),
  (1037, 'Gaia Cow Ghee 1 L Ceka Pack', 'Ghee', 'Gaia Cow Ghee Ceka Pack 1ltr', 'Ghee Sales', 'CBX', 18, 5, 180, 1, '45', 47),
  (1054, 'Gaia Cow Ghee 900 ml Ceka Pack', 'Ghee', 'Gaia Pure Cow Ghee Ceka Pack 900ml', 'Ghee Sales', 'CBX', 18, 5, 180, 0.9, '44', 48),
  (1043, 'Gaia Shrikhand 80 g', 'Sweets', 'Gaia Shrikhand KE 80g', 'Shrikhand Sale', 'CBX', 12, 5, 7, 0.08, '48', 49),
  (1058, 'Gaia Shrikhand 80 g Box (6 pc)', 'Sweets', 'Gaia Shrikhand KE 80g-Box (6Pc)', 'Shrikhand Sale', 'CBX', 6, 5, 7, 0.08, '49', 50),
  (1048, 'Gaia Shahi Rabdi 80 g Tray', 'Sweets', 'Gaia Shahi Rabdi 80g (1cup6pcs)', 'Rabdi Sales', 'CBX', 6, 5, 7, 0.08, '47', 51),
  (1036, 'Gaia Shahi Rabdi 80 g Box', 'Sweets', 'Gaia Shahi Rabdi 80g (1cup6pcs)', 'Rabdi Sales', 'CBX', 12, 5, 7, 0.08, '47', 52),
  (1057, 'Gaia Shahi Rabdi 80 g Box (6 pc)', 'Sweets', 'Gaia Shahi Rabdi 80g-Box(6Pc)', 'Rabdi Sales', 'CBX', 6, 5, 7, 0.08, '47', 53),
  (1034, 'Gaia Peda 200 g', 'Sweets', 'Gaia Peda 200 Gm Pcs', 'Peda Sales', 'CBX', 1, 5, 7, 0.2, '50', 54),
  (1049, 'Gaia Kesar Peda 200 g', 'Sweets', 'Gaia Kesar Peda 200 Gm Pcs', 'Peda Sales', 'CBX', 1, 5, 7, 0.2, '51', 55),
  (1035, 'Khowa Brown 1 kg', 'Sweets', 'Khowa Brown ( Unsweetened )', 'Khowa Sales', 'KG', 1, 5, 5, 1, '53', 56);

insert into route_order_party (name, route_id, channel, group_name, tally_ledger, state, consignee_name, consignee_address, consignee_state, consignee_pincode, consignee_gstin, buyer_address, buyer_gstin, buyer_pincode, consolidated, review_note) values
  ('1 Dollarmoffee Private Limited', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, '1 Dollarmoffee Private Limited', 'Chhattisgarh', '1 Dollarmoffee Private Limited', 'Near of Patwari Karyal,Ward No61bhatagaon', 'Chhattisgarh', '492015', '22AABCZ9582C1ZP', 'Near of Patwari Karyal,Ward No61bhatagaon', '22AABCZ9582C1ZP', '492015', false, null),
  ('56 Bhog Misthan', (select id from route_order_route where name = 'Raipur 1'), 'ATP', null, '56 Bhog Misthan', 'Chhattisgarh', '56 Bhog Misthan', 'Khata No.88, Plot No.623,Infront of Khandelwal
Book Store, Road No.03,Kantabanji,Balangir
Odisha,767039', 'Odisha', '767039', '21ANDPJ9765B1Z8', 'Khata No.88, Plot No.623,Infront of Khandelwal
Book Store, Road No.03,Kantabanji,Balangir
Odisha,767039', '21ANDPJ9765B1Z8', '767039', false, null),
  ('Aditi Ispat And Power Private Limited', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Aditi Ispat and Power Private Limited', 'Chhattisgarh', 'Aditi Ispat and Power Private Limited', 'B20, A-140, SECTOR 7B, KAMAL VIHAR, RAIPUR, Raipur,
Chhattisgarh, 492001', 'Chhattisgarh', '492001', '22AAECA8516C2Z6', 'B20, A-140, SECTOR 7B, KAMAL VIHAR, RAIPUR, Raipur,
Chhattisgarh, 492001', '22AAECA8516C2Z6', '492001', false, null),
  ('Amar Enterprises', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Amar Enterprises', 'Chhattisgarh', 'Amar Enterprises', 'Amar Palace Vidhan Sabha Marg Pandir Raipur
ADHAR NO-668230564694', 'Chhattisgarh', '492003', '22ADDPB9960A1Z4', 'Amar Palace Vidhan Sabha Marg Pandir Raipur
ADHAR NO-668230564694', '22ADDPB9960A1Z4', '492003', false, null),
  ('Amit Kirana Stores', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Amit Kirana Stores', 'Chhattisgarh', 'Amit Kirana Stores', 'Bazar Chowk, Sondra Gram,
Sankara, Dharsiwa, Raipur', 'Chhattisgarh', '493221', '22AEKPJ1133K1ZT', 'Bazar Chowk, Sondra Gram,
Sankara, Dharsiwa, Raipur', '22AEKPJ1133K1ZT', '493221', false, null),
  ('Apna Mart New Rajendra Nagar', (select id from route_order_route where name = 'Raipur 1'), 'MFS', null, 'Apna Mart', 'Chhattisgarh', 'Apna Mart', null, null, null, null, null, null, null, false, 'REVIEW: ''Apna Mart'' not found in Tally LEDGER master (closest: ''Anantra Mart'', 76%). Row left unchanged - verify spelling or create this ledger in Tally.'),
  ('Apna Mart Tatibandh', (select id from route_order_route where name = 'Raipur 1'), 'MFS', null, 'Apna  Mart', 'Chhattisgarh', 'Apna  Mart', null, null, null, null, null, null, null, false, 'REVIEW: ''Apna Mart'' not found in Tally LEDGER master (closest: ''Anantra Mart'', 76%). Row left unchanged - verify spelling or create this ledger in Tally.'),
  ('Artech Hospitalities', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Artech Hospitalities', 'Chhattisgarh', 'Artech Hospitalities', 'Godwit in Front of Hotel Hyatt,
Near Magneto the Mall,
Labhandi, Raipur', 'Chhattisgarh', '492006', '22ABNFA6667M1ZX', 'Godwit in Front of Hotel Hyatt,
Near Magneto the Mall,
Labhandi, Raipur', '22ABNFA6667M1ZX', '492006', false, null),
  ('Arti Beverages & Foods - Gayatri Nagar', (select id from route_order_route where name = 'Raipur 1'), 'MFS', 'MFS', 'Aarti Beverages  and Foods LLp', 'Chhattisgarh', 'Aarti Beverages  and Foods LLp', 'near jagnnath mandir gaytri nagar', 'Chhattisgarh', '492007', '22ABEFA6160G1ZV', 'near jagnnath mandir gaytri nagar', '22ABEFA6160G1ZV', '492007', false, null),
  ('Aryavarta Hospitality', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Aryavarta Hospitality', 'Chhattisgarh', 'Aryavarta Hospitality', 'G.E. ROAD/VIP ROAD, RAIPUR (C.G.)', 'Chhattisgarh', '492001', '22ABKFA6250F1ZS', 'G.E. ROAD/VIP ROAD, RAIPUR (C.G.)', '22ABKFA6250F1ZS', '492001', false, null),
  ('Bafna & Sons', (select id from route_order_route where name = 'Raipur 1'), 'ATP', null, 'Bafna & Sons', 'Chhattisgarh', 'Bafna & Sons', '01 Danteshwari Residency,Aghanpur,Dharampura
Zone Jagdalpur,Bastar', 'Chhattisgarh', '494001', '22BJPPB2543A1ZX', '01 Danteshwari Residency,Aghanpur,Dharampura
Zone Jagdalpur,Bastar', '22BJPPB2543A1ZX', '494001', false, null),
  ('Bhavesh Traders', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Bhavesh Traders', 'Chhattisgarh', 'Bhavesh Traders', 'KM Patel Compound New Timber Market
Fafadih
Raipur', 'Chhattisgarh', '492001', '22AXXPB9632R1ZN', 'KM Patel Compound New Timber Market
Fafadih
Raipur', '22AXXPB9632R1ZN', '492001', false, null),
  ('Blink Commerce Private Limited', (select id from route_order_route where name = 'Raipur 1'), 'Other', null, 'BLINK COMMERCE PRIVATE LIMITED', 'Chhattisgarh', 'BLINK COMMERCE PRIVATE LIMITED', 'H.No.3-6-70, Unit No.101,102 & 103, Bashir Bagh Road, Hyderabad, Hyderabad,Telangana, 500001', 'Telangana', '500001', '36AAFCG9846E2ZB', 'H.No.3-6-70, Unit No.101,102 & 103, Bashir Bagh Road, Hyderabad, Hyderabad,Telangana, 500001', '36AAFCG9846E2ZB', '500001', false, null),
  ('Bs Hospitality Service Pind Balluchi Restaurant', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'BS  Hospitality Service', 'Chhattisgarh', 'BS  Hospitality Service', 'Vishal Nagar Raipur', 'Chhattisgarh', '492001', '22ABAFB6194R1Z1', 'Vishal Nagar Raipur', '22ABAFB6194R1Z1', '492001', false, null),
  ('Cconceptt Hotels & Resorts', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Cconceptt Hotels & Resorts', 'Chhattisgarh', 'Cconceptt Hotels & Resorts', 'Top Floor,A Wing Babbylon Tower, VIP Road Raipur', 'Chhattisgarh', '492001', '22FWVPS1171N1ZR', 'Top Floor,A Wing Babbylon Tower, VIP Road Raipur', '22FWVPS1171N1ZR', '492001', false, null),
  ('Chahna Palace', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Chahna Palace', 'Chhattisgarh', 'Chahna Palace', 'Muhurat Resort
Ring Road 3
Pirda Road', 'Chhattisgarh', '493111', '22AKLPK9277C3Z0', 'Muhurat Resort
Ring Road 3
Pirda Road', '22AKLPK9277C3Z0', '493111', false, null),
  ('Ciaana The Bakers', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Ciaana the Bakers', 'Chhattisgarh', 'Ciaana the Bakers', 'HIG 27, Shankar nagar, Raipur, Raipur, Chhattisgarh', 'Chhattisgarh', '492004', '22AENPG2144Q2ZB', 'HIG 27, Shankar nagar, Raipur, Raipur, Chhattisgarh', '22AENPG2144Q2ZB', '492004', false, null),
  ('Dawoodi Bohra Jamaat Trust', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Dawoodi Bohra Jamaat Trust', 'Chhattisgarh', 'Dawoodi Bohra Jamaat Trust', 'Bohra Noor Masjid Campus
Nayapara Road, Sadar bazar
Raipur', 'Chhattisgarh', '492001', null, 'Bohra Noor Masjid Campus
Nayapara Road, Sadar bazar
Raipur', null, '492001', false, null),
  ('Deepak Dairy', (select id from route_order_route where name = 'Raipur 1'), 'ATP', null, 'Deepak Dairy', 'Chhattisgarh', 'Deepak Dairy', 'C/o Late Bhajan Lal Khatwani House,No.101
Subhash Ward,Kanker-494334', 'Chhattisgarh', '494334', null, 'C/o Late Bhajan Lal Khatwani House,No.101
Subhash Ward,Kanker-494334', null, '494334', false, null),
  ('DN Enterprises', (select id from route_order_route where name = 'Raipur 1'), 'Other', null, 'DN Enterprises', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Dwarika Cafe & Restaurant', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Dwarika Cafe & Restaurant', 'Chhattisgarh', 'Dwarika Cafe & Restaurant', 'Kutchery Chowk, Raipur', 'Chhattisgarh', '492001', null, 'Kutchery Chowk, Raipur', null, '492001', false, null),
  ('Fortune Overses', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Fortune Overses', 'Chhattisgarh', 'Fortune Overses', 'B-14, Dumartarai,Wholesale Market, Sardar
Vallabh Bhai Patel, Raipur', 'Chhattisgarh', '492015', '22AAJFF3985G1ZC', 'B-14, Dumartarai,Wholesale Market, Sardar
Vallabh Bhai Patel, Raipur', '22AAJFF3985G1ZC', '492015', false, null),
  ('Gagan Chhabda', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Gagan Chhabda', 'Chhattisgarh', 'Gagan Chhabda', 'Near Panjab Tadka dhaba Vinayak Heights lane,Zora, Raipur,492012', 'Chhattisgarh', '492001', '22AWSPC0389C1ZS', '16/233, NEAR GAJANAN TEMPLE
TATYAPARA, RAIPUR,Raipur, Chhattisgarh, 492001', '22AWSPC0389C1ZS', '492001', false, null),
  ('Gaia Fresh Live', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Gaia Fresh Live', 'Chhattisgarh', 'Gaia Fresh Live', 'Pandri
Raipur', 'Chhattisgarh', '492001', '22AAWFG2290A1ZM', 'Pandri
Raipur', '22AAWFG2290A1ZM', '492001', false, null),
  ('Ganga Prashad Enterprise', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Ganga Prasad Enterprises', 'Chhattisgarh', 'Ganga Prasad Enterprises', 'Santosh Nagar, Near Idea Tower,
Birgaon, Raipur', 'Chhattisgarh', '492001', null, 'Santosh Nagar, Near Idea Tower,
Birgaon, Raipur', null, '492001', false, null),
  ('Godavari Power And Ispat Limited', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Godavari Power and Ispat Limited', 'Chhattisgarh', 'Godavari Power and Ispat Limited', 'Plot No. 428/2 Phase -1,Industial Area, Siltara
Raipur', 'Chhattisgarh', '493111', '22AAACI7189K1ZB', 'Plot No. 428/2 Phase -1,Industial Area, Siltara
Raipur', '22AAACI7189K1ZB', '493111', false, null),
  ('Goyal Milk Dairy', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Goyal Milk Dairy', 'Chhattisgarh', 'Goyal Milk Dairy', 'Pro. Sonu Ram Goyal
Shrinagar, Near Neem Dabri Talab,
Khamtrai, Raipur (C.G.)', 'Chhattisgarh', '492001', null, 'Pro. Sonu Ram Goyal
Shrinagar, Near Neem Dabri Talab,
Khamtrai, Raipur (C.G.)', null, '492001', false, null),
  ('Goyal Milk Diary', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Goyal Milk Dairy', 'Chhattisgarh', 'Goyal Milk Dairy', 'Pro. Sonu Ram Goyal
Shrinagar, Near Neem Dabri Talab,
Khamtrai, Raipur (C.G.)', 'Chhattisgarh', '492001', null, 'Pro. Sonu Ram Goyal
Shrinagar, Near Neem Dabri Talab,
Khamtrai, Raipur (C.G.)', null, '492001', false, null),
  ('Goyal Ventures', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', 'Institution', 'Goyal Ventures', 'Chhattisgarh', 'Goyal Ventures', 'M7-D-101 Anandam World City
Kachna Road
Shankar Nagar, Raipur', 'Chhattisgarh', '492001', '22AXLPG9585C1ZD', 'M7-D-101 Anandam World City
Kachna Road
Shankar Nagar, Raipur', '22AXLPG9585C1ZD', '492001', false, null),
  ('Hare Gwaala Food Pvt.Ltd', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', 'DN Enterprises GT', 'Hare Gwaala Food Pvt.Ltd', 'Chhattisgarh', 'Hare Gwaala Food Pvt.Ltd', 'Floor No.: B-52, Building No./Flat No.: SEC-8
Kmala Vihar Devpuri', 'Chhattisgarh', '492001', '22AAGCH6839K1ZB', 'Floor No.: B-52, Building No./Flat No.: SEC-8
Kmala Vihar Devpuri', '22AAGCH6839K1ZB', '492001', false, null),
  ('Horilal And Sons', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Horilal and Sons', 'Chhattisgarh', 'Horilal and Sons', 'Main Road, Birgaon,
Raipur', 'Chhattisgarh', '493221', '22BWEPD4580R1Z8', 'Main Road, Birgaon,
Raipur', '22BWEPD4580R1Z8', '493221', false, null),
  ('Hotel Babylon-Inn Private Limited', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', 'Naveen Agency', 'Hotel Babylon INN Private Limited', 'Chhattisgarh', 'Hotel Babylon INN Private Limited', 'HOTEL BABYLON INN, JAIL ROAD, RAIPUR, Raipur, Chhattisgarh,', 'Chhattisgarh', '492001', '22AABCH4455L1ZM', 'HOTEL BABYLON INN, JAIL ROAD, RAIPUR, Raipur, Chhattisgarh,', '22AABCH4455L1ZM', '492001', false, null),
  ('Indira Trivedi', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Indira Tivedi', 'Chhattisgarh', 'Indira Tivedi', 'Baudi Nursing Home Gali Budhpara', 'Chhattisgarh', '492001', null, 'Baudi Nursing Home Gali Budhpara', null, '492001', false, null),
  ('Jai Maa Bhagwati Daily Needs', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Jai maa bhagwati daily needs', 'Chhattisgarh', 'Jai Maa Bhagwati Daily Needs', 'Ward No-67 Bhaktamata Karma Ward,Dharsiwa,Raipur', 'Chhattisgarh', '492001', null, 'Ward No-67 Bhaktamata Karma Ward,Dharsiwa,Raipur', null, '492001', false, null),
  ('Kanger Valley Academy School', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Kanger Valley Academy school', 'Chhattisgarh', 'Kanger Valley Academy school', 'Kanger Valley Academy
Behind old Amanaka thana
Beside Pt. Ravishankar shukla university
Dumar Talab', 'Chhattisgarh', '492099', null, 'Kanger Valley Academy
Behind old Amanaka thana
Beside Pt. Ravishankar shukla university
Dumar Talab', null, '492099', false, null),
  ('Kanhaiya Caterers', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Kanhaiya Caterers', 'Chhattisgarh', 'Kanhaiya Caterers', 'H No-44 Beside Jaggannath Temple Gaytari Nagar,
Raipur,492005', 'Chhattisgarh', '492005', '22AJUPB5225F2ZH', 'H No-44 Beside Jaggannath Temple Gaytari Nagar,
Raipur,492005', '22AJUPB5225F2ZH', '492005', false, null),
  ('Kartik Daily Needs', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Kartik Daily Needs', 'Chhattisgarh', 'Kartik Daily Needs', '1271 Sahupara Ward No 23, Ward No-13 Rajeev
Gandhi Ward,Dharsiwa, Raipur,492009', 'Chhattisgarh', '492009', null, '1271 Sahupara Ward No 23, Ward No-13 Rajeev
Gandhi Ward,Dharsiwa, Raipur,492009', null, '492009', false, null),
  ('M S Hospitality', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'M S Hospitality', 'Chhattisgarh', 'M S Hospitality', 'First Floor Hop No F2,F3 and F4 Saffron Corporate
Elibandha Chowk,New Raipur,492001', 'Chhattisgarh', '492001', '22ACEFM7941E1ZE', 'First Floor Hop No F2,F3 and F4 Saffron Corporate
Elibandha Chowk,New Raipur,492001', '22ACEFM7941E1ZE', '492001', false, null),
  ('Mahatari Agro Foods Enterprises', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Mahatari Agro Foods Enterprises', 'Chhattisgarh', 'Mahatari Agro Foods Enterprises', 'Makan No.115 Ward No 33 Jagriti Nagar
Birgaon Dharsiwa
Fssai-20524079003705', 'Chhattisgarh', '493221', null, 'Makan No.115 Ward No 33 Jagriti Nagar
Birgaon Dharsiwa
Fssai-20524079003705', null, '493221', false, null),
  ('Manglani Masala And Dal Bhandar', (select id from route_order_route where name = 'Raipur 1'), 'ATP', null, 'Manglani Masala and Dal Bhandar', 'Chhattisgarh', 'Manglani Masala and Dal Bhandar', '245,Gurunanak Ward No 11,Tilda Neora,Raipur
493114', 'Chhattisgarh', '493114', '22AQBPM9820B1ZB', '245,Gurunanak Ward No 11,Tilda Neora,Raipur
493114', '22AQBPM9820B1ZB', '493114', false, null),
  ('Manoj Chourasiya', (select id from route_order_route where name = 'Raipur 1'), 'Other', null, 'Manoj Chourasiya', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Milky Way Dairy Raipur', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Milky Way Dairy Raipur', 'Chhattisgarh', 'Milky Way Dairy Raipur', 'Md. Ahtesham Quraishi,H.No.40/277,Nizamuddin Chowk
Sanjay Nagar,Raipur', 'Chhattisgarh', null, null, 'Md. Ahtesham Quraishi,H.No.40/277,Nizamuddin Chowk
Sanjay Nagar,Raipur', null, null, false, null),
  ('Modi Tea Stall', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Modi Tea Stall', 'Chhattisgarh', 'Modi Tea Stall', 'Gudhyari Raipur', 'Chhattisgarh', '492001', null, 'Gudhyari Raipur', null, '492001', false, null),
  ('Mohammad Khalil', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Mohammad Khalil', 'Chhattisgarh', 'Mohammad Khalil', 'Chandani Chowk Nehru Nagar', 'Chhattisgarh', '492001', null, 'Chandani Chowk Nehru Nagar', null, '492001', false, null),
  ('Mps Kitchen', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'MPS Kitchen', 'Chhattisgarh', 'MPS Kitchen', 'D.N. Heights Lalpur , Opposite  Jainam Vihar
Lalpur  , Raipur', 'Chhattisgarh', '492001', '22ABVFM0296L1ZQ', 'D.N. Heights Lalpur , Opposite  Jainam Vihar
Lalpur  , Raipur', '22ABVFM0296L1ZQ', '492001', false, null),
  ('Mukesh Kirana Store', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Mukesh Kirana Store', 'Chhattisgarh', 'Mukesh Kirana Store', 'Maa Shitala Electricals and Switch Gear Parts 32
MD 153, Mandir Hasaud
Raipur', 'Chhattisgarh', '492101', '22ABFPH7650F1ZZ', 'Maa Shitala Electricals and Switch Gear Parts 32
MD 153, Mandir Hasaud
Raipur', '22ABFPH7650F1ZZ', '492101', false, null),
  ('Mulakaraj Naresh Kumar', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Mulakaraj Naresh Kumar', 'Chhattisgarh', 'Mulakaraj Naresh Kumar', 'Main Road, Tahsilpara, Narayanpur', 'Chhattisgarh', '494661', '22AABPE9843N1ZK', 'Main Road, Tahsilpara, Narayanpur', '22AABPE9843N1ZK', '494661', false, null),
  ('Nemras & Co', (select id from route_order_route where name = 'Raipur 1'), 'GT', 'DN Enterprises GT', 'Nemras & Co', 'Chhattisgarh', 'Nemras & Co.', '321,Panchwati Nagar,Near Shiv Complex,Mowa,
Raipur', 'Chhattisgarh', '492001', '22DVGPP5147B1ZU', '321,Panchwati Nagar,Near Shiv Complex,Mowa,
Raipur', '22DVGPP5147B1ZU', '492001', false, null),
  ('Niraj Tiwari', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Niraj Tiwari', 'Chhattisgarh', 'Niraj Tiwari', 'H.No. S -7/10, H.B. Colony
Gangotri Ward, Donde Khurd, Raipur', 'Chhattisgarh', '493111', null, 'H.No. S -7/10, H.B. Colony
Gangotri Ward, Donde Khurd, Raipur', null, '493111', false, null),
  ('Om Agency', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Om Agency', 'Chhattisgarh', 'Om Agency', 'D 41, Rishabh Colony, Amlidhih,
Ravigram, Raipur', 'Chhattisgarh', '492001', '22AJIPA9146J1ZA', 'D 41, Rishabh Colony, Amlidhih,
Ravigram, Raipur', '22AJIPA9146J1ZA', '492001', false, null),
  ('Qantas Hospitality', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Qantas Hospitality', 'Chhattisgarh', 'Qantas Hospitality', 'B-301,Phase-2
Magneto Signature Homes
Infront of Magneto Mall
Raipur', 'Chhattisgarh', '492001', '22AABFQ4217C1ZY', 'B-301,Phase-2
Magneto Signature Homes
Infront of Magneto Mall
Raipur', '22AABFQ4217C1ZY', '492001', false, null),
  ('Rajyog Enterprises', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Rajyog Enterprises', 'Chhattisgarh', 'Rajyog Enterprises', 'Ground Floor, Ravindranath Tagore Ward
Raipur', 'Chhattisgarh', '492015', '22BBLPL8837M1Z2', 'Ground Floor, Ravindranath Tagore Ward
Raipur', '22BBLPL8837M1Z2', '492015', false, null),
  ('Rasvi Foods (Rama World)', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Rasvi Foods (Rama World)', 'Chhattisgarh', 'Rasvi Foods (Rama World)', 'Rama World
Vidhan Sabha Road
Raipur', 'Chhattisgarh', '492005', '22ABMFR7095P1ZB', 'Rama World
Vidhan Sabha Road
Raipur', '22ABMFR7095P1ZB', '492005', false, null),
  ('Real Combo', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Real Combo', 'Chhattisgarh', 'Real Combo', 'BESIDE NISSAN AND DATSUN CASH SHOWROOM
OPP MAGNETO MALL
Raipur', 'Chhattisgarh', '492001', '22AVLPT5442K1Z7', 'BESIDE NISSAN AND DATSUN CASH SHOWROOM
OPP MAGNETO MALL
Raipur', '22AVLPT5442K1Z7', '492001', false, null),
  ('Real Combo Devendra Nagar', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Real Combo', 'Chhattisgarh', 'Real Combo', 'Beside SKM devendra nagar, Lal chowk', 'Chhattisgarh', '492001', '22AVLPT5442K1Z7', 'Beside SKM devendra nagar, Lal chowk', '22AVLPT5442K1Z7', '492001', false, null),
  ('Real Combo Pachpedi Naka', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Real Combo', 'Chhattisgarh', 'Real Combo', 'Gandhi chowk Devpuri Ravindranath
taigore chowk ward 51
Tikrapara, Raipur, Chhattisgarh 492001,', 'Chhattisgarh', '492001', '22AVLPT5442K1Z7', 'Gandhi chowk Devpuri Ravindranath
taigore chowk ward 51
Tikrapara, Raipur, Chhattisgarh 492001,', '22AVLPT5442K1Z7', '492001', false, null),
  ('Rich Food Products', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Rich food products', 'Chhattisgarh', 'Rich Food Products', '16-1-19, GNS Holyday Inn
Collector Office Down, Maharani Pet
Visakhapatnam', 'Andhra Pradesh', '530002', '37AAHPI0803L1ZT', '16-1-19, GNS Holyday Inn
Collector Office Down, Maharani Pet
Visakhapatnam', '37AAHPI0803L1ZT', '530002', false, null),
  ('Santosh Marketing', (select id from route_order_route where name = 'Raipur 1'), 'ATP', null, 'Santosh Marketing', 'Chhattisgarh', 'Santosh Marketing', 'Ground Floor Behind Shiva Video Kanta Ghar, Shakambari Chhattisgarh,492002', 'Chhattisgarh', '492002', '22AERFS1557H1ZT', 'Ground Floor Behind Shiva Video Kanta Ghar, Shakambari Chhattisgarh,492002', '22AERFS1557H1ZT', '492002', false, null),
  ('Shalabh Traders', (select id from route_order_route where name = 'Raipur 1'), 'ATP', null, 'Shalabh Traders', 'Chhattisgarh', 'Shalabh Traders', 'B-31, Vedanta City, Bagadai Mata Mandir Road Kandul, Raipur Chhattisgarh,492013', 'Chhattisgarh', '492013', '22EWBPG8443J1ZJ', 'B-31, Vedanta City, Bagadai Mata Mandir Road Kandul, Raipur Chhattisgarh,492013', '22EWBPG8443J1ZJ', '492013', false, null),
  ('Sharma Bekary', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Sharma Bekary', 'Chhattisgarh', 'Sharma Bekary', null, null, null, null, null, null, null, false, 'REVIEW: ''Sharma Bekary'' not found in Tally LEDGER master (closest: ''Sharma Bekary SD'', 90%). Row left unchanged - verify spelling or create this ledger in Tally.'),
  ('Shivam Commercials', (select id from route_order_route where name = 'Raipur 1'), 'Other', null, 'Shivam Commercials', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Shree Balaji Trading', (select id from route_order_route where name = 'Raipur 1'), 'ATP', 'Others', 'Shree Balaji Trading', 'Chhattisgarh', 'Shree Balaji Trading', 'Shop No. C- 41
Sardar Vallabh Bhai Patel Wholesale Market
Dumartarai, Raipur', 'Chhattisgarh', null, '22AAQPY2608A1ZV', 'Shop No. C- 41
Sardar Vallabh Bhai Patel Wholesale Market
Dumartarai, Raipur', '22AAQPY2608A1ZV', null, false, null),
  ('Shree Sai Services Aiims', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Shree Sai Services Private Limited', 'Chhattisgarh', 'Shree Sai Services Private Limited', 'AIIMS Tatibandh', 'Chhattisgarh', '492099', '22ABGCS0268L1Z9', 'AIIMS Tatibandh', '22ABGCS0268L1Z9', '492099', false, null),
  ('Shri Bajrang Power And Ispat Ltd', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Shri Bajrang Power and Ispat Ltd', 'Chhattisgarh', 'Shri Bajrang Power and Ispat Ltd', 'Shri Bajrang Power and Ispat ltd (TMT Division)
Kh. No: 2/3, Vill. Gondwara, Urla Industrial Complex
Raipur', 'Chhattisgarh', '493221', '22AACCB2944D1ZA', 'Shri Bajrang Power and Ispat ltd (TMT Division)
Kh. No: 2/3, Vill. Gondwara, Urla Industrial Complex
Raipur', '22AACCB2944D1ZA', '493221', false, null),
  ('Shrikant Pandey', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Shrikant Pandey', 'Chhattisgarh', 'Shrikant Pandey', 'H.No. 321, Benind Shiv Complex,
Panchavati Nagar
Shankar Nagar, Raipur', 'Chhattisgarh', null, null, 'H.No. 321, Benind Shiv Complex,
Panchavati Nagar
Shankar Nagar, Raipur', null, null, false, null),
  ('Shubharambh Food Ventures', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Shubharambh Food Ventures', 'Chhattisgarh', 'Shubharambh Food Ventures', 'Near 36 Mall Besides Vidhayak Colony Labhandi Raipur.', 'Chhattisgarh', '492001', '22AFSFS9710E1ZT', 'Near 36 Mall Besides Vidhayak Colony Labhandi Raipur.', '22AFSFS9710E1ZT', '492001', false, null),
  ('Shyam Traders', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Shyam Traders', 'Chhattisgarh', 'Shyam Traders', 'Shop No.11B, Nivedita School Parisar
Gurunanak Chowk
Raipur', 'Chhattisgarh', '492001', '22ACOPA2942F1Z2', 'Shop No.11B, Nivedita School Parisar
Gurunanak Chowk
Raipur', '22ACOPA2942F1Z2', '492001', false, null),
  ('Sukh Sagar Restaurants', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Sukh Sagar Restaurants', 'Chhattisgarh', 'Sukh Sagar Restaurants', 'SUKH SAGAR PHOOL CHOWK RAIPUR, Chhattisgarh,', 'Chhattisgarh', '492001', '22AAIFM5731AIZU', 'SUKH SAGAR PHOOL CHOWK RAIPUR, Chhattisgarh,', '22AAIFM5731AIZU', '492001', false, null),
  ('Tao Hospitality Private Limited', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Tao Hospitality Private Limited', 'Chhattisgarh', 'Tao hospitality pvt ltd (TAO)', 'A-19 Vip Estate, Khamadih Shankar Nagar,Mowa, Raipur', 'Chhattisgarh', '492001', '22AAICT4590P1ZR', 'A-19 Vip Estate, Khamadih Shankar Nagar,Mowa, Raipur', '22AAICT4590P1ZR', '492001', false, null),
  ('Tao Hospitality Private Limited (Ark)', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Tao Hospitality Private Limited', 'Chhattisgarh', 'Tao Hospitality Private Limited (ARK)', 'A-19 Vip Estate, Khamadih Shankar Nagar,Mowa, Raipur', 'Chhattisgarh', '492001', '22AAICT4590P1ZR', 'A-19 Vip Estate, Khamadih Shankar Nagar,Mowa, Raipur', '22AAICT4590P1ZR', '492001', false, null),
  ('Tao Hospitality Private Limited (Marcos)', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Tao Hospitality Private Limited', 'Chhattisgarh', 'Tao Hospitality Private Limited (MARCOS)', 'A-19 Vip Estate, Khamadih Shankar Nagar,Mowa, Raipur', 'Chhattisgarh', '492001', '22AAICT4590P1ZR', 'A-19 Vip Estate, Khamadih Shankar Nagar,Mowa, Raipur', '22AAICT4590P1ZR', '492001', false, null),
  ('The Lunchbox', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'The Lunchbox', 'Chhattisgarh', 'The Lunchbox', 'Behind Girls Hostel
Balaji Hostel, Mowa
Raipur', 'Chhattisgarh', '492001', '22ANJPS5148R1Z9', 'Behind Girls Hostel
Balaji Hostel, Mowa
Raipur', '22ANJPS5148R1Z9', '492001', false, null),
  ('Tipsy Events', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Tipsy Events', 'Chhattisgarh', 'Tipsy Events Labhandih', '00,Zone by the Park GE Road Raipur 492006', 'Chhattisgarh', '492006', '22BWWPK6101M1Z8', 'behind Cloud 9 Apartment, Raipur, Labhandih, Chhattisgarh 492012, India', '22BWWPK6101M1Z8', '492006', false, null),
  ('United Foodbrands Limited', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'United Foodbrands Limited', 'Chhattisgarh', 'United Foodbrands Limited', '2ND FLOOR, UNIT SFPH 02-03, MAGNETO
SHOPPING MALL, LABHANDI ROAD, RAIPUR,
Raipur, Chhattisgarh, 492010', 'Chhattisgarh', null, '22AAKCS3053N1Z6', '2ND FLOOR, UNIT SFPH 02-03, MAGNETO
SHOPPING MALL, LABHANDI ROAD, RAIPUR,
Raipur, Chhattisgarh, 492010', '22AAKCS3053N1Z6', null, false, null),
  ('Urvi Marketing', (select id from route_order_route where name = 'Raipur 1'), 'GT', null, 'Urvi Marketing', 'Chhattisgarh', 'Urvi Marketing', 'Beside Ekta Juice,
Holy Mother School Street,
Sunder Nager, Raipur', 'Chhattisgarh', '492001', '22AEOPL7606M1Z5', 'Beside Ekta Juice,
Holy Mother School Street,
Sunder Nager, Raipur', '22AEOPL7606M1Z5', '492001', false, null),
  ('Vishal Jain', (select id from route_order_route where name = 'Raipur 1'), 'Other', null, 'Vishal Jain', 'Chhattisgarh', 'Vishal Jain', null, 'Chhattisgarh', null, null, null, null, null, false, null),
  ('Wasabi Raipur', (select id from route_order_route where name = 'Raipur 1'), 'Institutional', null, 'Wasabi Raipur', 'Chhattisgarh', 'Wasabi Raipur', 'HIG-1 Sector-1,Shankar Nagar Road,Near Turning
Point Shankar Nagar,Raipur', 'Chhattisgarh', '492004', '22BWOPA5554Q1Z3', 'HIG-1 Sector-1,Shankar Nagar Road,Near Turning
Point Shankar Nagar,Raipur', '22BWOPA5554Q1Z3', '492004', false, null),
  ('Aaranyam Enterprises', (select id from route_order_route where name = 'Raipur 2'), 'Institutional', null, 'Aaranyam Enterprises', 'Chhattisgarh', 'Aaranyam Enterprises', 'H.No. - E-503, Palm Residency,
Katora Talab Road,
Old Rajendra Nagar, Raipur', 'Chhattisgarh', '492001', '22ABXFA6467B1ZC', 'H.No. - E-503, Palm Residency,
Katora Talab Road,
Old Rajendra Nagar, Raipur', '22ABXFA6467B1ZC', '492001', false, null),
  ('Ambika Realtech Maira Resort', (select id from route_order_route where name = 'Raipur 2'), 'Institutional', null, 'Ambika Realtech', 'Chhattisgarh', 'Ambika Realtech', 'MAIRA RESORT AND CONVENTION CENTER
ARANG ROAD, UMARIYA VILLAGE,
NEAR INTERNATIONAL CRICKET STADIUM
RAIPUR, CHHATTISHGARH - 493441', 'Chhattisgarh', '493441', '22ABTFA9252E1ZD', 'MAIRA RESORT AND CONVENTION CENTER
ARANG ROAD, UMARIYA VILLAGE,
NEAR INTERNATIONAL CRICKET STADIUM
RAIPUR, CHHATTISHGARH - 493441', '22ABTFA9252E1ZD', '493441', false, null),
  ('Anand Milk Agency', (select id from route_order_route where name = 'Raipur 2'), 'Institutional', null, 'Anand Milk Agency', 'Chhattisgarh', 'Anand Milk Agency', 'Karan Nagar, Om Ata Chakki Ke Pass
Changora Bhata, Raipur', 'Chhattisgarh', '492001', null, 'Karan Nagar, Om Ata Chakki Ke Pass
Changora Bhata, Raipur', null, '492001', false, null),
  ('Anil Medical Stores', (select id from route_order_route where name = 'Raipur 2'), 'GT', null, 'Anil Medical Stores', 'Chhattisgarh', 'Anil Medical Stores', 'Sadar Bazar, Nawa Para,
Rajim, Raipur', 'Chhattisgarh', '493881', '22AJGPS9660R1ZB', 'Sadar Bazar, Nawa Para,
Rajim, Raipur', '22AJGPS9660R1ZB', '493881', false, null),
  ('Apna Mart Changorabhata', (select id from route_order_route where name = 'Raipur 2'), 'MFS', null, 'Apna  Mart', 'Chhattisgarh', 'Apna  Mart', null, null, null, null, null, null, null, false, 'REVIEW: ''Apna Mart'' not found in Tally LEDGER master (closest: ''Anantra Mart'', 76%). Row left unchanged - verify spelling or create this ledger in Tally.'),
  ('Apna Mart Devendra Nagar', (select id from route_order_route where name = 'Raipur 2'), 'MFS', null, 'Apna  Mart', 'Chhattisgarh', 'Apna  Mart', null, null, null, null, null, null, null, false, 'REVIEW: ''Apna Mart'' not found in Tally LEDGER master (closest: ''Anantra Mart'', 76%). Row left unchanged - verify spelling or create this ledger in Tally.'),
  ('Apna Mart Kabir Nagar', (select id from route_order_route where name = 'Raipur 2'), 'MFS', null, 'Apna  Mart', 'Chhattisgarh', 'Apna  Mart', null, null, null, null, null, null, null, false, 'REVIEW: ''Apna Mart'' not found in Tally LEDGER master (closest: ''Anantra Mart'', 76%). Row left unchanged - verify spelling or create this ledger in Tally.'),
  ('Apna Mart Samta Colony', (select id from route_order_route where name = 'Raipur 2'), 'MFS', null, 'Apna  Mart', 'Chhattisgarh', 'Apna  Mart', null, null, null, null, null, null, null, false, 'REVIEW: ''Apna Mart'' not found in Tally LEDGER master (closest: ''Anantra Mart'', 76%). Row left unchanged - verify spelling or create this ledger in Tally.'),
  ('Apna Mart Shrinagar', (select id from route_order_route where name = 'Raipur 2'), 'MFS', null, 'Apna  Mart', 'Chhattisgarh', 'Apna  Mart', null, null, null, null, null, null, null, false, 'REVIEW: ''Apna Mart'' not found in Tally LEDGER master (closest: ''Anantra Mart'', 76%). Row left unchanged - verify spelling or create this ledger in Tally.'),
  ('Apna Mart Tagore Nagar', (select id from route_order_route where name = 'Raipur 2'), 'MFS', null, 'Apna  Mart', 'Chhattisgarh', 'Apna  Mart', null, null, null, null, null, null, null, false, 'REVIEW: ''Apna Mart'' not found in Tally LEDGER master (closest: ''Anantra Mart'', 76%). Row left unchanged - verify spelling or create this ledger in Tally.'),
  ('Apna Mart Telibandha', (select id from route_order_route where name = 'Raipur 2'), 'MFS', null, 'Apna  Mart', 'Chhattisgarh', 'Apna  Mart', null, null, null, null, null, null, null, false, 'REVIEW: ''Apna Mart'' not found in Tally LEDGER master (closest: ''Anantra Mart'', 76%). Row left unchanged - verify spelling or create this ledger in Tally.'),
  ('Chartered Hotels Private Limited', (select id from route_order_route where name = 'Raipur 2'), 'Institutional', null, 'Chartered Hotels Private Limited', 'Chhattisgarh', 'Chartered Hotels Private Limited', 'Magent the Mall, N.H.-6 Labhandi, Raipur (C.G)
RAIPUR', 'Chhattisgarh', '492001', '22AAACC5002F1ZK', 'Magent the Mall, N.H.-6 Labhandi, Raipur (C.G)
RAIPUR', '22AAACC5002F1ZK', '492001', false, null),
  ('Chhutki Dairy', (select id from route_order_route where name = 'Raipur 2'), 'GT', null, 'Chhutki Dairy', 'Chhattisgarh', 'Chhutki Dairy', 'Nav Durga Nagar,
Mathpurena, Raipur', 'Chhattisgarh', null, null, 'Nav Durga Nagar,
Mathpurena, Raipur', null, null, false, null),
  ('Chourasiya Marketing', (select id from route_order_route where name = 'Raipur 2'), 'GT', null, 'Chourasiya Markenting', 'Chhattisgarh', 'Chourasiya Markenting', 'Mana Road, Rawan Bhata,
Ward No. - 18, Mandirhasoud,
Raipur', 'Chhattisgarh', '492101', '22ANGPC6687A1ZD', 'Mana Road, Rawan Bhata,
Ward No. - 18, Mandirhasoud,
Raipur', '22ANGPC6687A1ZD', '492101', false, null),
  ('Clean World', (select id from route_order_route where name = 'Raipur 2'), 'Institutional', null, 'Clean World', 'Chhattisgarh', 'Clean World', 'Tuck Shop
HNLU campus
New Raipur,493661', 'Chhattisgarh', '493661', '22CJAPA1004R1ZR', 'Tuck Shop
HNLU campus
New Raipur,493661', '22CJAPA1004R1ZR', '493661', false, null),
  ('Cm Dairy', (select id from route_order_route where name = 'Raipur 2'), 'GT', null, 'CM Dairy', 'Chhattisgarh', 'CM Dairy', 'Arang Raipur', 'Chhattisgarh', '493661', null, 'Arang Raipur', null, '493661', false, null),
  ('Deepak Kumar Sharma', (select id from route_order_route where name = 'Raipur 2'), 'GT', null, 'Deepak Kumar Sharma', 'Chhattisgarh', 'Deepak Kumar Sharma', 'S/O Virendra Sharma , 1645, Block No. 103- Ews ,
Housing Board Colony , Boria Kala , Raipur', 'Chhattisgarh', '492015', null, 'S/O Virendra Sharma , 1645, Block No. 103- Ews ,
Housing Board Colony , Boria Kala , Raipur', null, '492015', false, null),
  ('J P Cafe & Restaurant', (select id from route_order_route where name = 'Raipur 2'), 'GT', null, 'J P Cafe & Restaurant', 'Chhattisgarh', 'J P Cafe & Restaurant', 'Nelseri Polsan Jinson
Ward No.04 Altaf Bada Complex
Gobra Nawapara Nagar Panchayat
Abhanpur, Raipur', 'Chhattisgarh', '493881', null, 'Nelseri Polsan Jinson
Ward No.04 Altaf Bada Complex
Gobra Nawapara Nagar Panchayat
Abhanpur, Raipur', null, '493881', false, null),
  ('Jeevan Dairy', (select id from route_order_route where name = 'Raipur 2'), 'GT', null, 'Jeevan Dairy', 'Chhattisgarh', 'Jeevan Dairy', 'Bus Stand Abhanpur-493661', 'Chhattisgarh', '493661', null, 'Bus Stand Abhanpur-493661', null, '493661', false, null),
  ('Kanha Dairy', (select id from route_order_route where name = 'Raipur 2'), 'GT', null, 'Kanha Dairy', 'Chhattisgarh', 'Kanha Dairy', 'Village Post Champaran Bus Stand
493885', 'Chhattisgarh', '493885', null, 'Village Post Champaran Bus Stand
493885', null, '493885', false, null),
  ('Lalwani Stores', (select id from route_order_route where name = 'Raipur 2'), 'GT', 'DN Enterprises GT', 'Lalwani Kirana', 'Chhattisgarh', 'Lalwani Kirana', null, null, null, null, null, null, null, false, 'REVIEW: ''Lalwani Kirana'' not found in Tally LEDGER master (closest: ''Yadav Kirana'', 69%). Row left unchanged - verify spelling or create this ledger in Tally.'),
  ('Manoj Kumar Sarkar', (select id from route_order_route where name = 'Raipur 2'), 'GT', null, 'Manoj Kumar Sarkar', 'Chhattisgarh', 'Manoj Kumar Sarkar', 'Mana Camp, Devbhog Milk Parlour
Mana, Raipur', 'Chhattisgarh', '492001', '22HKIPS2133B1ZJ', 'Mana Camp, Devbhog Milk Parlour
Mana, Raipur', '22HKIPS2133B1ZJ', '492001', false, null),
  ('Namrata Sample', (select id from route_order_route where name = 'Raipur 2'), 'Other', 'MFS', 'Namrata Sample', 'Chhattisgarh', 'Namrata Sample', null, null, null, null, null, null, null, false, 'REVIEW: ''Namrata Sample'' not found in Tally LEDGER master (closest: ''Amit Sample'', 80%). Row left unchanged - verify spelling or create this ledger in Tally.'),
  ('Neverno Allied Services Pvt. Ltd.', (select id from route_order_route where name = 'Raipur 2'), 'Institutional', 'DN Enterprises GT', 'Neverno Allied Services Pvt.Ltd', 'Chhattisgarh', 'Neverno Allied Services Pvt.Ltd', 'Dawda Colony Pachpedi naka Raipur.', 'Chhattisgarh', '492001', '22AAICN0923C1Z3', 'Dawda Colony Pachpedi naka Raipur.', '22AAICN0923C1Z3', '492001', false, null),
  ('Office Sample', (select id from route_order_route where name = 'Raipur 2'), 'Other', null, 'Office Sample', 'Chhattisgarh', 'Office Sample', null, 'Chhattisgarh', null, null, null, null, null, false, null),
  ('Saha Agency', (select id from route_order_route where name = 'Raipur 2'), 'GT', null, 'Saha Agency', 'Chhattisgarh', 'Saha Agency', 'Main Road Mana Camp
Raipur', 'Chhattisgarh', '492015', null, 'Main Road Mana Camp
Raipur', null, '492015', false, null),
  ('Sanjay Kumar Patre', (select id from route_order_route where name = 'Raipur 2'), 'GT', null, 'Sanjay Kumar Patre', 'Chhattisgarh', 'Sanjay Kumar Patre', 'Ward No-60 Rawatpura Colony Phase,2 Near Priya
Kirana Store,Bhatgaon,Dharsiwa,Raipur', 'Chhattisgarh', '492013', '22BWIPP9077M1ZS', 'Ward No-60 Rawatpura Colony Phase,2 Near Priya
Kirana Store,Bhatgaon,Dharsiwa,Raipur', '22BWIPP9077M1ZS', '492013', false, null),
  ('Santosh Kumar Sagar', (select id from route_order_route where name = 'Raipur 2'), 'GT', null, 'Santosh Kumar Sagar', 'Chhattisgarh', 'Santosh Kumar Sagar', '319 Dr. Varate Ke Baju, Gurudwara Ke Piche,
Purana Kanshi Ram Nagar, Telibandha, Raipur', 'Chhattisgarh', '492006', '22EVLPS0407M1ZD', '319 Dr. Varate Ke Baju, Gurudwara Ke Piche,
Purana Kanshi Ram Nagar, Telibandha, Raipur', '22EVLPS0407M1ZD', '492006', false, null),
  ('Shree Sai Services Hnlu', (select id from route_order_route where name = 'Raipur 2'), 'Institutional', null, 'Shree Sai Services', 'Chhattisgarh', 'Shree Sai Services', 'HNLU Naya Raipur', 'Chhattisgarh', '493661', '22BENPS7522D1ZI', 'HNLU Naya Raipur', '22BENPS7522D1ZI', '493661', false, null),
  ('Shree Sai Services Iiit New Raipur', (select id from route_order_route where name = 'Raipur 2'), 'Institutional', null, 'Shree Sai Services Private Limited', 'Chhattisgarh', 'Shree Sai Services IIIT New Raipur', 'Plot No. 7
near Purkhoti Muktangan
Sector 24
Atal Nagar-Nava Raipur, Uparwara', 'Chhattisgarh', '492001', '22ABGCS0268L1Z9', 'Plot No. 7
near Purkhoti Muktangan
Sector 24
Atal Nagar-Nava Raipur, Uparwara', '22ABGCS0268L1Z9', '492001', false, null),
  ('Shreeji Caterers', (select id from route_order_route where name = 'Raipur 2'), 'Institutional', null, 'Shreeji Caterers', 'Chhattisgarh', 'Shreeji Caterers', 'Shubh Vyapar Vihar,Raheja Cutting,Opp Sadani Darbar, Next To Shankaracharya Matt,Dumartarai, Raipur', 'Chhattisgarh', '492015', '22ANGPP4368P2ZE', 'Shubh Vyapar Vihar,Raheja Cutting,Opp Sadani Darbar, Next To Shankaracharya Matt,Dumartarai, Raipur', '22ANGPP4368P2ZE', '492015', false, null),
  ('Skm Abhanpur', (select id from route_order_route where name = 'Raipur 2'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Main Road Dhamtari
Krishi Upaj Mandi
Infront of SBI Bank, Abhanpur', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Main Road Dhamtari
Krishi Upaj Mandi
Infront of SBI Bank, Abhanpur', '22AASCS8717K1ZR', '492001', false, null),
  ('Skm Rajim', (select id from route_order_route where name = 'Raipur 2'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Bhagwan Mahavir Chowk
Gunj Road, Nawa Para Rajim', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Bhagwan Mahavir Chowk
Gunj Road, Nawa Para Rajim', '22AASCS8717K1ZR', '492001', false, null),
  ('Sodexo India Services Pvt Ltd Kalinga U', (select id from route_order_route where name = 'Raipur 2'), 'Institutional', null, 'Sodexo India Services Pvt Ltd', 'Chhattisgarh', 'Sodexo India Services Pvt Ltd', 'Near Mantralaya, Kotni, Atal Nagar-Nava Raipur,', 'Chhattisgarh', '492101', '22AAACR2547Q1Z6', 'Near Mantralaya, Kotni, Atal Nagar-Nava Raipur,', '22AAACR2547Q1Z6', '492101', false, null),
  ('Tandan Milk', (select id from route_order_route where name = 'Raipur 2'), 'GT', null, 'Tandan Milk', 'Chhattisgarh', 'Tandan Milk', 'Sector 17, Commercial Complex
Kotrabhata, Arang, Raipur', 'Chhattisgarh', '492101', null, 'Sector 17, Commercial Complex
Kotrabhata, Arang, Raipur', null, '492101', false, null),
  ('Tipsy Mantralaya', (select id from route_order_route where name = 'Raipur 2'), 'Institutional', null, 'Tipsy Events', 'Chhattisgarh', 'Tipsy Mantralaya', '00,Zone by the Park GE Road Raipur 492006', 'Chhattisgarh', '492006', '22BWWPK6101M1Z8', 'Sector 19, Atal Nagar-Nava Raipur, Chhattisgarh, India 492002', '22BWWPK6101M1Z8', '492006', false, null),
  ('Vedanta Medical-Balco Hospital', (select id from route_order_route where name = 'Raipur 2'), 'Institutional', null, 'Sodexo India Services Pvt Ltd', 'Chhattisgarh', 'Vedanta Medical-Balco hospital', 'Near Mantralaya, Kotni, Atal Nagar-Nava Raipur,', 'Chhattisgarh', '492002', '22AAACR2547Q1Z6', 'INC0139301-Vedanta Medical-Balco Hospital GRAM RAIPUR_492002', '22AAACR2547Q1Z6', '492101', false, null),
  ('Yaaran Da Adda', (select id from route_order_route where name = 'Raipur 2'), 'Institutional', null, 'Yaaran Da Adda', 'Chhattisgarh', 'Yaaran Da Adda', 'INFRONT OF GATE NO.5 OF AIMS, TATIBANDH, Raipur
Chhattisgarh, 492001', 'Chhattisgarh', '492001', '22ACXPH0039H3ZO', 'INFRONT OF GATE NO.5 OF AIMS, TATIBANDH, Raipur
Chhattisgarh, 492001', '22ACXPH0039H3ZO', '492001', false, null),
  ('Anantra Mart Bhathagaon', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Anatra Mart', 'Anantra Mart', 'Chhattisgarh', 'Anantra Mart', 'Bhatagaon
Raipur', 'Chhattisgarh', '492001', '22ACAFA2307C1ZG', 'Bhatagaon
Raipur', '22ACAFA2307C1ZG', '492001', false, null),
  ('Anantra Mart Boriyakala', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Anatra Mart', 'Anantra Mart', 'Chhattisgarh', 'Anantra Mart', 'Boriyakala
Raipur', 'Chhattisgarh', '492001', '22ACAFA2307C1ZG', 'Boriyakala
Raipur', '22ACAFA2307C1ZG', '492001', false, null),
  ('Anantra Mart Kt', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Anatra Mart', 'Anantra Mart', 'Chhattisgarh', 'Anantra Mart', 'Katora Talab', 'Chhattisgarh', '492001', '22ACAFA2307C1ZG', 'Katora Talab', '22ACAFA2307C1ZG', '492001', false, null),
  ('Anantra Mart Kushalpur', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Anatra Mart', 'Anantra Mart', 'Chhattisgarh', 'Anantra Mart', 'Kushalpur', 'Chhattisgarh', '492013', '22ACAFA2307C1ZG', 'Kushalpur', '22ACAFA2307C1ZG', '492013', false, null),
  ('Anantra Mart Santoshi Nagar', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Anatra Mart', 'Anantra Mart', 'Chhattisgarh', 'Anantra Mart', 'Santoshi Nagar', 'Chhattisgarh', '492001', '22ACAFA2307C1ZG', 'Santoshi Nagar', '22ACAFA2307C1ZG', '492001', false, null),
  ('Arti Beverages & Foods - Boriyakala Old Dhamtari Raod', (select id from route_order_route where name = 'Raipur 3'), 'Other', null, 'Arti Beverages & Foods - Boriyakala Old Dhamtari Raod', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Ashoka Mart- Ashokaratan', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Aarti Beverages and Foods LLp', 'Aarti Beverages  and Foods LLp', 'Chhattisgarh', 'Aarti Beverages  and Foods LLp', 'Shri Sai Complex , Ram Nagar, Kota Road
Raipur (C.G.)', 'Chhattisgarh', '492001', '22ABEFA6160G1ZV', 'Shri Sai Complex , Ram Nagar, Kota Road
Raipur (C.G.)', '22ABEFA6160G1ZV', '492001', false, null),
  ('Ashoka Mart- Birgaon', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Aarti Beverages and Foods LLp', 'Aarti Beverages  and Foods LLp', 'Chhattisgarh', 'Aarti Beverages  and Foods LLp', 'Birgaon', 'Chhattisgarh', '492003', '22ABEFA6160G1ZV', 'Birgaon', '22ABEFA6160G1ZV', '492003', false, null),
  ('Ashoka Mart- Gaytri Nagar', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Aarti Beverages and Foods LLp', 'Aarti Beverages  and Foods LLp', 'Chhattisgarh', 'Aarti Beverages  and Foods LLp', 'near jagnnath mandir gaytri nagar', 'Chhattisgarh', '492007', '22ABEFA6160G1ZV', 'near jagnnath mandir gaytri nagar', '22ABEFA6160G1ZV', '492007', false, null),
  ('Ashoka Mart-Kushalpur', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Aarti Beverages and Foods LLp', 'Aarti Beverages  and Foods LLp', 'Chhattisgarh', 'Aarti Beverages  and Foods LLp', 'Kushalpur', 'Chhattisgarh', '492001', '22ABEFA6160G1ZV', 'Kushalpur', '22ABEFA6160G1ZV', '492001', false, null),
  ('D-Mart 36 City Center Mall', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Avenue Supermarts Ltd', 'Avenue Supermarts Ltd 2026-27', 'Chhattisgarh', 'Avenue Supermarts Ltd 2026-27', '36, City Mall, Govt Eng.', 'Chhattisgarh', '492001', '22AACCA8432H1Z0', '36, City Mall, Govt Eng.', '22AACCA8432H1Z0', '492001', false, null),
  ('D-Mart Dc Raipur', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Avenue Supermarts Ltd', 'Avenue Supermarts Ltd 2026-27', 'Chhattisgarh', 'Avenue Supermarts Ltd 2026-27', 'ASL OIL DC Chawla Infrastructure
557/22, Ring Road no-03,gram-giroud,
Raipur Municipal Corporation, Raipur', 'Chhattisgarh', '493111', '22AACCA8432H1Z0', 'ASL OIL DC Chawla Infrastructure
557/22, Ring Road no-03,gram-giroud,
Raipur Municipal Corporation, Raipur', '22AACCA8432H1Z0', '493111', false, null),
  ('D-Mart Devpuri', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Avenue Supermarts Ltd', 'Avenue Supermarts Ltd 2026-27', 'Chhattisgarh', 'Avenue Supermarts Ltd 2026-27', 'Devpuri, Raipur
Khasra No. 168,169 & 171, Kamal
Sector-11 A, Village Khunda', 'Chhattisgarh', '492015', '22AACCA8432H1Z0', 'Devpuri, Raipur
Khasra No. 168,169 & 171, Kamal
Sector-11 A, Village Khunda', '22AACCA8432H1Z0', '492015', false, null),
  ('D-Mart Ring Road Raipur', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Avenue Supermarts Ltd', 'Avenue Supermarts Ltd 2026-27', 'Chhattisgarh', 'Avenue Supermarts Ltd 2026-27', 'Ring Road Raipur DMart', 'Chhattisgarh', '492012', '22AACCA8432H1Z0', 'Ring Road Raipur DMart', '22AACCA8432H1Z0', '492012', false, null),
  ('Dmart Devpuri,Raipur', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Avenue Supermarts Ltd', 'Avenue Supermarts Ltd 2026-27', 'Chhattisgarh', 'Avenue Supermarts Ltd 2026-27', 'Devpuri, Raipur
Khasra No. 168,169 & 171, Kamal
Sector-11 A, Village Khunda', 'Chhattisgarh', '492015', '22AACCA8432H1Z0', 'Devpuri, Raipur
Khasra No. 168,169 & 171, Kamal
Sector-11 A, Village Khunda', '22AACCA8432H1Z0', '492015', false, null),
  ('E-Commerce Platform', (select id from route_order_route where name = 'Raipur 3'), 'Other', null, 'E-commerce platform', 'Chhattisgarh', 'E-commerce platform', null, 'Chhattisgarh', null, null, null, null, null, false, null),
  ('Fleet Lab Technologies Pvt. Ltd.', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'MFS', 'Fleet Labs Technologies Pvt.Ltd', 'Chhattisgarh', 'Fleet Labs Technologies Pvt.Ltd', '29,Off Canal Linking Road, Indrawati Colony,
Raipur', 'Chhattisgarh', '492001', '22AAECF6112B1ZG', '29,Off Canal Linking Road, Indrawati Colony,
Raipur', '22AAECF6112B1ZG', '492001', false, null),
  ('Gaia Fresh Foods ( Mobile App)', (select id from route_order_route where name = 'Raipur 3'), 'Other', null, 'Gaia Fresh Foods ( Mobile App)', 'Chhattisgarh', 'Gaia Fresh Foods ( Mobile App)', 'RAIPUR
Raipur
Raipur', 'Chhattisgarh', '492001', '22AAWFG2290A1ZM', 'RAIPUR
Raipur
Raipur', '22AAWFG2290A1ZM', '492001', false, null),
  ('Gaia Fresh Foods Pandri (Retail)', (select id from route_order_route where name = 'Raipur 3'), 'Other', null, 'Gaia Fresh Foods Pandri  ( Retail )', 'Chhattisgarh', 'Gaia Fresh Foods Pandri  ( Retail )', 'Raipur', 'Chhattisgarh', '492001', '22AAWFG2290A1ZM', 'Raipur', '22AAWFG2290A1ZM', '492001', false, null),
  ('Next G-Mart (Opc) Private Limited', (select id from route_order_route where name = 'Raipur 3'), 'MFS', null, 'Next G-Mart (Opc) Private Limited', 'Chhattisgarh', 'Next G-Mart (Opc) Private Limited', 'Next G-Mart (Opc) Private Limited
C/O Ashish Nathani, Main Road,
Sejbahar, Raipur,
Chhattisgarh, 492001', 'Chhattisgarh', '492015', '22AALCN0850D1ZW', 'Xtramart
Shree Parisar,Old Dhamtari Road,
Behind SBI Atm,Sejbahar,Raipur
Chhattishgarh,492015', '22AALCN0850D1ZW', '492001', false, null),
  ('Relaince Retail Ltd.Tekari', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'MFS', 'Relaince Retail Ltd.Tekari', 'Chhattisgarh', 'Relaince Retail Ltd.Tekari', null, null, null, null, null, null, null, false, 'REVIEW: ''Relaince Retail Ltd.Tekari'' not found in Tally LEDGER master (closest: ''SD Reliance Retail Ltd.'', 77%). Row left unchanged - verify spelling or create this ledger in Tally.'),
  ('Rrl Dumartarai', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Ambhuja Mall Frgm', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Chandra Sequire Tn54', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Colour Mall Tfd6', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Dunda U11C', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Heerapur U2S8', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Katora Talab U435', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Magneto Mall Frgy', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Mahadev Ghat Tdi2', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Pandri T62I', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Pujari Chamber U199', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Srinagar Raipur U1Wa', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Tekari', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Shree Mega Mart Amleshwar', (select id from route_order_route where name = 'Raipur 3'), 'Other', null, 'Shree Mega Mart', 'Chhattisgarh', 'Shree Mega Mart', 'Near Honda Showroom
Amleshwar Durg', 'Chhattisgarh', '492001', '22AEEFS4723G1ZA', 'Near Honda Showroom
Amleshwar Durg', '22AEEFS4723G1ZA', '492001', false, null),
  ('Shree Mega Mart Bhanpuri', (select id from route_order_route where name = 'Raipur 3'), 'Other', null, 'Shree Mega Mart', 'Chhattisgarh', 'Shree Mega Mart', 'Shop No. 3-4, Sun and Sun Cold Storage,
Bilaspur Road, Bhanpuri, Raipur', 'Chhattisgarh', '492001', '22AEEFS4723G1ZA', 'Shop No. 3-4, Sun and Sun Cold Storage,
Bilaspur Road, Bhanpuri, Raipur', '22AEEFS4723G1ZA', '492001', false, null),
  ('Shree Mega Mart Birgaon', (select id from route_order_route where name = 'Raipur 3'), 'Other', null, 'Shree Mega Mart', 'Chhattisgarh', 'Shree Mega Mart', 'Near DM Tower Venu Petrol Pump
Bilaspur Road, Birgaon', 'Chhattisgarh', '492001', '22AEEFS4723G1ZA', 'Near DM Tower Venu Petrol Pump
Bilaspur Road, Birgaon', '22AEEFS4723G1ZA', '492001', false, null),
  ('Skm Bhatagaon', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Bhatagaon Chowk
Raipur', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Bhatagaon Chowk
Raipur', '22AASCS8717K1ZR', '492001', false, null),
  ('Skm Kushalpur', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Kushalpur, Raipur', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Kushalpur, Raipur', '22AASCS8717K1ZR', '492001', false, null),
  ('Skm Sunder Nagar', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Arihant Jewellers Complex
Ashwani Nagar, Sunder Nagar Road
Raipur', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Arihant Jewellers Complex
Ashwani Nagar, Sunder Nagar Road
Raipur', '22AASCS8717K1ZR', '492001', false, null),
  ('Skm-Birgaon', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Birgaon Urla Road
Opp. to Sumit Bazar', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Birgaon Urla Road
Opp. to Sumit Bazar', '22AASCS8717K1ZR', '492001', false, null),
  ('Skm-Devendra Nagar', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Devendra Nagar, Raipur', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Devendra Nagar, Raipur', '22AASCS8717K1ZR', '492001', false, null),
  ('Skm-Gudhiyari', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Gudhiyari, Raipur', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Gudhiyari, Raipur', '22AASCS8717K1ZR', '492001', false, null),
  ('Skm-Kamal Vihar', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Kamal Vihar, Raipur', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Kamal Vihar, Raipur', '22AASCS8717K1ZR', '492001', false, null),
  ('Skm-Kamal Vihar Ghee', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Kamal Vihar, Raipur', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Kamal Vihar, Raipur', '22AASCS8717K1ZR', '492001', false, null),
  ('Skm-Kota', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Kota, Raipur', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Kota, Raipur', '22AASCS8717K1ZR', '492001', false, null),
  ('Skm-Pandri', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Pandri Raipur', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Pandri Raipur', '22AASCS8717K1ZR', '492001', false, null),
  ('Skm-Purani Basti', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Purani Basti, Raipur', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Purani Basti, Raipur', '22AASCS8717K1ZR', '492001', false, null),
  ('Skm-Santoshi Nagar', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Santoshi Nagar, Raipur', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Santoshi Nagar, Raipur', '22AASCS8717K1ZR', '492001', false, null),
  ('Skm-Sarona', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Sarona, Raipur', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Sarona, Raipur', '22AASCS8717K1ZR', '492001', false, null),
  ('Skm-Vidhansabha', (select id from route_order_route where name = 'Raipur 3'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Main Road, Vidhansabha
Raipur', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Main Road, Vidhansabha
Raipur', '22AASCS8717K1ZR', '492001', false, null),
  ('Society Activities And Events', (select id from route_order_route where name = 'Raipur 3'), 'Other', null, 'Society Activities and Events', 'Chhattisgarh', 'Society Activities and Events', null, 'Chhattisgarh', null, null, null, null, null, false, null),
  ('Society Activity & Event', (select id from route_order_route where name = 'Raipur 3'), 'Other', null, 'Society Activity & Event', 'Chhattisgarh', 'Society Activity & Event', null, null, null, null, null, null, null, false, 'REVIEW: ''Society Activity & Event'' not found in Tally LEDGER master (closest: ''Society Activities and Events'', 83%). Row left unchanged - verify spelling or create this ledger in Tally.'),
  ('Swinsta Ent Pvt Ltd - Devendra Nagar', (select id from route_order_route where name = 'Raipur 3'), 'Online', null, 'Swinsta Ent Private Limited', 'Chhattisgarh', 'Swinsta Ent Pvt Ltd - Devendra Nagar', 'Ground Floor, Central Warehouse, Raipur-1, Raipur, Chhattisgarh, India - 492004', 'Chhattisgarh', '492010', '22ABICS9840E1ZA', 'Ground Floor, Central Warehouse, Raipur-1, Raipur, Chhattisgarh, India - 492004', '22ABICS9840E1ZA', '492010', false, null),
  ('Swinsta Ent Pvt Ltd - Professor Colony', (select id from route_order_route where name = 'Raipur 3'), 'Online', null, 'Swinsta Ent Private Limited', 'Chhattisgarh', 'Swinsta Ent Pvt Ltd - Professor Colony', 'Ground Floor, Ward No. 65, Maharaj Band Talab, Professor Colony, Raipur, Chhattisgarh, India - 492001', 'Chhattisgarh', '492010', '22ABICS9840E1ZA', 'Ground Floor, Ward No. 65, Maharaj Band Talab, Professor Colony, Raipur, Chhattisgarh, India - 492001', '22ABICS9840E1ZA', '492010', false, null),
  ('Swinsta Ent Pvt Ltd - Purnea', (select id from route_order_route where name = 'Raipur 3'), 'Online', null, 'Swinsta Ent Private Limited', 'Chhattisgarh', 'Swinsta Ent Pvt Ltd - Purnea', 'Ground Floor, Ward No. 52, Amlidih Main Road, Ganga Vihar, Raipur, Chhattisgarh, India - 492001', 'Chhattisgarh', '492010', '22ABICS9840E1ZA', 'Ground Floor, Ward No. 52, Amlidih Main Road, Ganga Vihar, Raipur, Chhattisgarh, India - 492001', '22ABICS9840E1ZA', '492010', false, null),
  ('Swinsta Ent Pvt Ltd - Saraswati Nagar', (select id from route_order_route where name = 'Raipur 3'), 'Online', null, 'Swinsta Ent Private Limited', 'Chhattisgarh', 'Swinsta Ent Pvt Ltd - Saraswati Nagar', 'Khasra No. 116, 119, HA No. 104, Doomratalab, Mahoba Bazar, GE Road, Raipur, Chhattisgarh, India - 492010', 'Chhattisgarh', '492010', '22ABICS9840E1ZA', 'Khasra No. 116, 119, HA No. 104, Doomratalab, Mahoba Bazar, GE Road, Raipur, Chhattisgarh, India - 492010', '22ABICS9840E1ZA', '492010', false, null),
  ('Ankit Traders', (select id from route_order_route where name = 'Bhilai'), 'GT', 'M P S Agency', 'M.P.S Agency', 'Chhattisgarh', 'M.P.S Agency', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', 'Chhattisgarh', '490023', '22DCDPS8152P1Z1', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', '22DCDPS8152P1Z1', '490023', true, null),
  ('Ashapura Kitchen Novelty', (select id from route_order_route where name = 'Bhilai'), 'GT', null, 'Ashapura Kitchen Novelty', 'Chhattisgarh', 'Ashapura Kitchen Novelty', 'Shree Ram Market Supela Bhilai', 'Chhattisgarh', '490023', '22ARRPK3352K1ZL', 'Shree Ram Market Supela Bhilai', '22ARRPK3352K1ZL', '490023', false, null),
  ('D-Mart Durg By Paas Nh-6 Bhilai', (select id from route_order_route where name = 'Bhilai'), 'MFS', 'Avenue Supermarts Ltd', 'Avenue Supermarts Ltd 2026-27', 'Chhattisgarh', 'Avenue Supermarts Ltd 2026-27', 'Durg By Paas NH-6, Bhilai
Durg By Paas NH-6, BhilaiNH-6 Bhilai DMart
Durg By Paas NH-6, Bhilai', 'Chhattisgarh', '491001', '22AACCA8432H1Z0', 'Durg By Paas NH-6, Bhilai
Durg By Paas NH-6, BhilaiNH-6 Bhilai DMart
Durg By Paas NH-6, Bhilai', '22AACCA8432H1Z0', '491001', false, null),
  ('D-Mart Potiyakala Durg', (select id from route_order_route where name = 'Bhilai'), 'MFS', 'Avenue Supermarts Ltd', 'Avenue Supermarts Ltd 2026-27', 'Chhattisgarh', 'Avenue Supermarts Ltd 2026-27', 'Potiyakala, Durg', 'Chhattisgarh', '491001', '22AACCA8432H1Z0', 'Potiyakala, Durg', '22AACCA8432H1Z0', '491001', false, null),
  ('D-Mart-Charoda Bhilai', (select id from route_order_route where name = 'Bhilai'), 'MFS', 'Avenue Supermarts Ltd', 'Avenue Supermarts Ltd 2026-27', 'Chhattisgarh', 'Avenue Supermarts Ltd 2026-27', 'ambadi nagar Bhilai DMart
G.E. Road, Near Ambadi Nagar Clolony', 'Chhattisgarh', '490025', '22AACCA8432H1Z0', 'ambadi nagar Bhilai DMart
G.E. Road, Near Ambadi Nagar Clolony', '22AACCA8432H1Z0', '490025', false, null),
  ('Indra General Store', (select id from route_order_route where name = 'Bhilai'), 'ATP', 'Bulk', 'Indra General Stores', 'Chhattisgarh', 'Indra General Stores', 'Camp No. - 2, Bhilai
Durg', 'Chhattisgarh', '490023', '22AAAFI5925J1ZJ', 'Camp No. - 2, Bhilai
Durg', '22AAAFI5925J1ZJ', '490023', false, null),
  ('Jain Trading Company', (select id from route_order_route where name = 'Bhilai'), 'ATP', null, 'Jain Trading Company', 'Chhattisgarh', 'Jain Trading Company', 'LIG 83, Vaishali Nagar, Supela, Bhilai, Durg, Chhattisgar', 'Chhattisgarh', '490023', '22AQOPJ0164C1ZC', 'LIG 83, Vaishali Nagar, Supela, Bhilai, Durg, Chhattisgar', '22AQOPJ0164C1ZC', '490023', false, null),
  ('Laxmi Trading', (select id from route_order_route where name = 'Bhilai'), 'GT', null, 'Laxmi Trading', 'Chhattisgarh', 'Laxmi Trading', 'Amapara Amba Chowk,Dhamtari', 'Chhattisgarh', '493773', '22GFVPS0174D1Z9', 'Amapara Amba Chowk,Dhamtari', '22GFVPS0174D1Z9', '493773', false, null),
  ('M P S Agency', (select id from route_order_route where name = 'Bhilai'), 'GT', 'M P S Agency', 'M.P.S Agency', 'Chhattisgarh', 'M.P.S Agency', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', 'Chhattisgarh', '490023', '22DCDPS8152P1Z1', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', '22DCDPS8152P1Z1', '490023', true, null),
  ('Mahesh Pan & Daily Needs', (select id from route_order_route where name = 'Bhilai'), 'GT', 'M P S Agency', 'M.P.S Agency', 'Chhattisgarh', 'M.P.S Agency', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', 'Chhattisgarh', '490023', '22DCDPS8152P1Z1', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', '22DCDPS8152P1Z1', '490023', true, null),
  ('Manish Milk Parlour', (select id from route_order_route where name = 'Bhilai'), 'GT', 'Manish Milk Parlour', 'Manish Milk Parlour', 'Chhattisgarh', 'Manish Milk Parlour', 'K. Adinarayan Shop no. 8D Market Sector 6 Bhilai', 'Chhattisgarh', '490006', null, 'K. Adinarayan Shop no. 8D Market Sector 6 Bhilai', null, '490006', false, null),
  ('Om Trading Company', (select id from route_order_route where name = 'Bhilai'), 'ATP', null, 'Om Trading Company', 'Chhattisgarh', 'Om Trading Company', 'Marwadi School Parisar, Shop No. 12,
Motipara, Durg, (C.G.)', 'Chhattisgarh', '491001', '22ACJPJ9797N1ZQ', 'Marwadi School Parisar, Shop No. 12,
Motipara, Durg, (C.G.)', '22ACJPJ9797N1ZQ', '491001', false, null),
  ('Om Trading Company Durg', (select id from route_order_route where name = 'Bhilai'), 'Other', null, 'Om Trading Company Durg', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Pardeshi Milk Dairy', (select id from route_order_route where name = 'Bhilai'), 'GT', null, 'Pardeshi Milk Dairy', 'Chhattisgarh', 'Pardeshi Milk Dairy', 'Azad Market (Hanuman Mandir) Risali Durg ( Chhattisgarh) 
490006', 'Chhattisgarh', '490006', null, 'Azad Market (Hanuman Mandir) Risali Durg ( Chhattisgarh) 
490006', null, '490006', false, null),
  ('Pawan Daily Needs', (select id from route_order_route where name = 'Bhilai'), 'GT', 'M P S Agency', 'M.P.S Agency', 'Chhattisgarh', 'M.P.S Agency', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', 'Chhattisgarh', '490023', '22DCDPS8152P1Z1', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', '22DCDPS8152P1Z1', '490023', true, null),
  ('Popular Traders', (select id from route_order_route where name = 'Bhilai'), 'Other', null, 'Popular Traders', 'Chhattisgarh', 'Popular Traders', 'H.NO. 1773, Yadav Para
Nehru Nagar, Galaxy Chowk
Andhi, Durg', 'Chhattisgarh', '490022', '22EJRPK7345J1ZQ', 'H.NO. 1773, Yadav Para
Nehru Nagar, Galaxy Chowk
Andhi, Durg', '22EJRPK7345J1ZQ', '490022', false, null),
  ('Pratham Baking Mart', (select id from route_order_route where name = 'Bhilai'), 'GT', 'M P S Agency', 'M.P.S Agency', 'Chhattisgarh', 'M.P.S Agency', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', 'Chhattisgarh', '490023', '22DCDPS8152P1Z1', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', '22DCDPS8152P1Z1', '490023', true, null),
  ('Rahul Traders', (select id from route_order_route where name = 'Bhilai'), 'Institutional', null, 'Rahul Traders', 'Chhattisgarh', 'Rahul Traders', 'Mahmara, Durg, Chhattisgarh 491001, India', 'Chhattisgarh', '491001', '22ARZPG7034Q2Z1', 'Mahmara, Durg, Chhattisgarh 491001, India', '22ARZPG7034Q2Z1', '491001', false, null),
  ('Riddhi Trading', (select id from route_order_route where name = 'Bhilai'), 'GT', 'M P S Agency', 'M.P.S Agency', 'Chhattisgarh', 'M.P.S Agency', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', 'Chhattisgarh', '490023', '22DCDPS8152P1Z1', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', '22DCDPS8152P1Z1', '490023', true, null),
  ('Rrl-Durg U2Vs', (select id from route_order_route where name = 'Bhilai'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Maharaja Chowk U284', (select id from route_order_route where name = 'Bhilai'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Nehru Nagar', (select id from route_order_route where name = 'Bhilai'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Smriti Nagar U558', (select id from route_order_route where name = 'Bhilai'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Supela Durg U395', (select id from route_order_route where name = 'Bhilai'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('S.K. Traders', (select id from route_order_route where name = 'Bhilai'), 'GT', null, 'S.K. Traders', 'Chhattisgarh', 'S.K. Traders', 'Manpreet Singh Chhabra
Sr. MIG 140A C/o Smt. Amarjit Kaur Chhabra
Housing Board Colony, Hatkeshar
Dhamtari', 'Chhattisgarh', '493773', '22BWOPC6881L1Z3', 'Manpreet Singh Chhabra
Sr. MIG 140A C/o Smt. Amarjit Kaur Chhabra
Housing Board Colony, Hatkeshar
Dhamtari', '22BWOPC6881L1Z3', '493773', false, null),
  ('Sai Kripa Dairy', (select id from route_order_route where name = 'Bhilai'), 'GT', 'M P S Agency', 'M.P.S Agency', 'Chhattisgarh', 'M.P.S Agency', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', 'Chhattisgarh', '490023', '22DCDPS8152P1Z1', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', '22DCDPS8152P1Z1', '490023', true, null),
  ('Samriddhi Dairy & Frozen Food', (select id from route_order_route where name = 'Bhilai'), 'GT', 'M P S Agency', 'M.P.S Agency', 'Chhattisgarh', 'M.P.S Agency', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', 'Chhattisgarh', '490023', '22DCDPS8152P1Z1', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', '22DCDPS8152P1Z1', '490023', true, null),
  ('Samta Provision', (select id from route_order_route where name = 'Bhilai'), 'GT', null, 'Samta Provision Dhamtari 25-26', 'Chhattisgarh', 'Samta Provision Dhamtari 25-26', '01, Samata Provision, Sadar Bazar Dhamtari, Dhamtari', 'Chhattisgarh', '493773', '22AYHPJ3129Q1Z7', '01, Samata Provision, Sadar Bazar Dhamtari, Dhamtari', '22AYHPJ3129Q1Z7', '493773', false, 'REVIEW: ''Samta Provision'' not found in Tally LEDGER master (closest: ''Samta Provision SD'', 91%). Row left unchanged - verify spelling or create this ledger in Tally.'),
  ('Shree Sai Services Iit Bhilai', (select id from route_order_route where name = 'Bhilai'), 'Institutional', null, 'Shree Sai Services Private Limited', 'Chhattisgarh', 'Shree Sai Services Private Limited', 'IIT Bhilai', 'Chhattisgarh', '492015', '22ABGCS0268L1Z9', 'IIT Bhilai', '22ABGCS0268L1Z9', '492015', false, null),
  ('Skm-Anjora', (select id from route_order_route where name = 'Bhilai'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Near Maitri Dental College', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Near Maitri Dental College', '22AASCS8717K1ZR', '492001', false, null),
  ('Skm-Junwani Road', (select id from route_order_route where name = 'Bhilai'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Junwani Road, Bhilai', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Junwani Road, Bhilai', '22AASCS8717K1ZR', '492001', false, null),
  ('Skm-Potiakala Pulgaon', (select id from route_order_route where name = 'Bhilai'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Potiakala,Pulgaon,Chhattisgarh', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Potiakala,Pulgaon,Chhattisgarh', '22AASCS8717K1ZR', '492001', false, null),
  ('Skm-Utai', (select id from route_order_route where name = 'Bhilai'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Utai, Durg', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Utai, Durg', '22AASCS8717K1ZR', '492001', false, null),
  ('Swinsta Ent Pvt Ltd - Surya Residency', (select id from route_order_route where name = 'Bhilai'), 'Online', null, 'Swinsta Ent Private Limited', 'Chhattisgarh', 'Swinsta Ent Pvt Ltd - Surya Residency', 'Ground Floor, Surya Residency, Nehru Nagar, Bhilai, Chhattisgarh, India - 490020', 'Chhattisgarh', '490020', '22ABICS9840E1ZA', 'Ground Floor, Surya Residency, Nehru Nagar, Bhilai, Chhattisgarh, India - 490020', '22ABICS9840E1ZA', '490020', false, null),
  ('Tamrakar Agency', (select id from route_order_route where name = 'Bhilai'), 'GT', 'M P S Agency', 'M.P.S Agency', 'Chhattisgarh', 'M.P.S Agency', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', 'Chhattisgarh', '490023', '22DCDPS8152P1Z1', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', '22DCDPS8152P1Z1', '490023', true, null),
  ('Tripti Misthan', (select id from route_order_route where name = 'Bhilai'), 'ATP', null, 'Tripti Misthan', 'Chhattisgarh', 'Tripti Misthan', '29d Plot No146/21,Sadar Bazar ,Hatri Bazar
Durg', 'Chhattisgarh', '491001', '22AJQPJ7374M1ZL', '29d Plot No146/21,Sadar Bazar ,Hatri Bazar
Durg', '22AJQPJ7374M1ZL', '491001', false, null),
  ('Tripti Restarurant', (select id from route_order_route where name = 'Bhilai'), 'ATP', null, 'Tripti Restarurant', 'Chhattisgarh', 'Tripti Restarurant', null, null, null, null, null, null, null, false, 'REVIEW: ''Tripti Restarurant'' not found in Tally LEDGER master (closest: ''Tripti Restaurent'', 91%). Row left unchanged - verify spelling or create this ledger in Tally.'),
  ('Vinay Agencies', (select id from route_order_route where name = 'Bhilai'), 'Bulk', null, 'Vinay Agencies', 'Chhattisgarh', 'Vinay Agencies', 'Hatri Bazar Durg
Fssai-10517006000637', 'Chhattisgarh', '491001', '22ADBPB8351M1ZQ', 'Hatri Bazar Durg
Fssai-10517006000637', '22ADBPB8351M1ZQ', '491001', false, null),
  ('Vinay Agency', (select id from route_order_route where name = 'Bhilai'), 'Other', null, 'Vinay Agency', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Vinayak Enterprises', (select id from route_order_route where name = 'Bhilai'), 'GT', null, 'Vinayak enterprises', 'Chhattisgarh', 'Vinayak Enterprises', 'Block-14,Plot-13,Nehru Nagal,Bhilai', 'Chhattisgarh', '490020', '22APLPC3539G1Z7', 'Block-14,Plot-13,Nehru Nagal,Bhilai', '22APLPC3539G1Z7', '490020', false, null),
  ('Vinayak Traders', (select id from route_order_route where name = 'Bhilai'), 'ATP', null, 'Vinayak Traders', 'Chhattisgarh', 'Vinayak Traders', 'Ram Nagar,Indra Chauk,Supela,Bhilai,Durg
490023', 'Chhattisgarh', '490023', null, 'Ram Nagar,Indra Chauk,Supela,Bhilai,Durg
490023', null, '490023', false, null),
  ('Yadav Kirana', (select id from route_order_route where name = 'Bhilai'), 'GT', 'M P S Agency', 'M.P.S Agency', 'Chhattisgarh', 'M.P.S Agency', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', 'Chhattisgarh', '490023', '22DCDPS8152P1Z1', 'P-E1-05, M/S M.P.S Agency,
Sirsa Road, Indira Chowk,
Bhilai, Durg, Chhattisgarh', '22DCDPS8152P1Z1', '490023', true, null),
  ('Abhi Enterprises', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Anna Da Dhaba', (select id from route_order_route where name = 'Bilaspur'), 'Institutional', null, 'Anna Da Dhaba', 'Chhattisgarh', 'Anna Da Dhaba', 'VILL GHODARI TEH DIST MAHASAMUND,', 'Chhattisgarh', '493445', null, 'VILL GHODARI TEH DIST MAHASAMUND,', null, '493445', false, null),
  ('Arti Daily Needs', (select id from route_order_route where name = 'Bilaspur'), 'GT', null, 'Arti Daily Needs', 'Chhattisgarh', 'Arti Daily Needs', 'Arang', 'Chhattisgarh', '493441', '22BGJPB2465C1Z1', 'Arang', '22BGJPB2465C1Z1', '493441', false, null),
  ('Ayan', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Bharat', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('D-Mart Sarkhanda, Bilaspur', (select id from route_order_route where name = 'Bilaspur'), 'MFS', 'Avenue Supermarts Ltd', 'Avenue Supermarts Ltd 2026-27', 'Chhattisgarh', 'Avenue Supermarts Ltd 2026-27', 'Sarkhanda, Bilaspur
Near Govt. Girls College
Bilaspur Municipal Corporation', 'Chhattisgarh', '495006', '22AACCA8432H1Z0', 'Sarkhanda, Bilaspur
Near Govt. Girls College
Bilaspur Municipal Corporation', '22AACCA8432H1Z0', '495006', false, null),
  ('Dheeraj', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Dilip', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Durgesh Gupta', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Ganesh Milk', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Gauri', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Harend', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Hari Dairy', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Kamlesh', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Kaushal', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Lala', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Maa Ambey', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Mahamaya Dairy', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Mahamaya Milk', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Manish Milk', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Navniraman Vanijya Private Limited', (select id from route_order_route where name = 'Bilaspur'), 'GT', null, 'Navniraman Vanijya Pvt.Ltd', 'Chhattisgarh', 'Navniraman Vanijya Pvt.Ltd', 'SECOND FLOOR, BLOCK C, RAO TRADE CENTRE, LINK ROAD,
Bilaspur, Chhattisgarh, 495001', 'Chhattisgarh', '495001', '22AAFCN0166N1ZG', 'SECOND FLOOR, BLOCK C, RAO TRADE CENTRE, LINK ROAD,
Bilaspur, Chhattisgarh, 495001', '22AAFCN0166N1ZG', '495001', false, null),
  ('R J', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Rahman Milk', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Raju Milk', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Rathi Agency Tilda', (select id from route_order_route where name = 'Bilaspur'), 'GT', null, 'Rathi Agency', 'Chhattisgarh', 'Rathi Agency', '64, Bazaar Para, Newra, Tilda, Raipur, Neora', 'Chhattisgarh', '493114', null, '64, Bazaar Para, Newra, Tilda, Raipur, Neora', null, '493114', false, null),
  ('Rn Super Bazar', (select id from route_order_route where name = 'Bilaspur'), 'ATP', null, 'RN Super Bazar', 'Chhattisgarh', 'RN Super Bazar', 'R.N. SUPER BAZAR, MANGLA, MANGLA, Bilaspur,
Chhattisgarh, 495001', 'Chhattisgarh', '495001', '22BABPS3013F1ZC', 'R.N. SUPER BAZAR, MANGLA, MANGLA, Bilaspur,
Chhattisgarh, 495001', '22BABPS3013F1ZC', '495001', false, null),
  ('Rohra', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Rrl- Magento Mall Frgz', (select id from route_order_route where name = 'Bilaspur'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Hemu Nagar U490', (select id from route_order_route where name = 'Bilaspur'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Infinity Height U2Kd', (select id from route_order_route where name = 'Bilaspur'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Jyoti Complex Sakri', (select id from route_order_route where name = 'Bilaspur'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Koni U3Qy', (select id from route_order_route where name = 'Bilaspur'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Mangla Chowk Tnb7', (select id from route_order_route where name = 'Bilaspur'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Rk Nagar U310', (select id from route_order_route where name = 'Bilaspur'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Sakri Uslapur U11M', (select id from route_order_route where name = 'Bilaspur'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Tagore Nagar Tkx6', (select id from route_order_route where name = 'Bilaspur'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Vypar Vihar U377', (select id from route_order_route where name = 'Bilaspur'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Sai Dairy', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Sapan Das', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Shree Darbar Sweets And Restaurant(Kharora)', (select id from route_order_route where name = 'Bilaspur'), 'GT', null, 'Shree Darbar Sweets and Restaurant(Kharora)', 'Chhattisgarh', 'Shree Darbar Sweets and Restaurant(Kharora)', 'Kharora (C.G.)', 'Chhattisgarh', null, null, 'Kharora (C.G.)', null, null, false, null),
  ('Shree Shyam', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Shri Krishna Dairy', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Surbhi', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Sushil Milk', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Swinsta Ent Pvt Ltd - Gandhi Chowk', (select id from route_order_route where name = 'Bilaspur'), 'Online', null, 'Swinsta Ent Private Limited', 'Chhattisgarh', 'Swinsta Ent Pvt Ltd - Gandhi Chowk', 'GF, 52/2 Snakar Bhawan, Sagar Kiryaya Bhandar, Dr. Ambedkar Nagar, Magarpara, Bilaspur, Chhattisgarh, India - 495001', 'Chhattisgarh', '495001', '22ABICS9840E1ZA', 'GF, 52/2 Snakar Bhawan, Sagar Kiryaya Bhandar, Dr. Ambedkar Nagar, Magarpara, Bilaspur, Chhattisgarh, India - 495001', '22ABICS9840E1ZA', '495001', false, null),
  ('Vinay Milk', (select id from route_order_route where name = 'Bilaspur'), 'GT', 'Universal Corp', 'Universal Corp', 'Chhattisgarh', 'Universal Corp', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', 'Chhattisgarh', '495001', '22EJNPA2954K1Z5', 'Shop No. 2/45, Nehru Complex,
Old RTO Office Vyapar Vihar,
Bilaspur', '22EJNPA2954K1Z5', '495001', true, null),
  ('Agrawal Agency', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'AgrawaL Agency', 'Chhattisgarh', 'AgrawaL Agency', 'Basna', 'Chhattisgarh', '493554', '22AKHPA5697C2ZF', 'Basna', '22AKHPA5697C2ZF', '493554', false, null),
  ('Ajay Gupta And Sons', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Ajay Gupta And Sons', 'Chhattisgarh', 'Ajay Gupta and Sons', 'Subhash Chowk, Nai Sadak Raigarh', 'Chhattisgarh', '496001', '22AXZPG3923G1ZD', 'Subhash Chowk, Nai Sadak Raigarh', '22AXZPG3923G1ZD', '496001', false, null),
  ('Ankit Bhojnalay', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Ankit Bhojnalay', 'Chhattisgarh', 'Ankit Bhojnalay', 'Kirodimal Nagar Raigarh', 'Chhattisgarh', null, null, 'Kirodimal Nagar Raigarh', null, null, false, null),
  ('Apna Kirana Store', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Apna Kirana Store', 'Chhattisgarh', 'Apna Kirana Store', 'JPL GATE NO-5 SALIHABHATTA
TAMNAR RAIGARH
Fassai-20523076000006', 'Chhattisgarh', '496107', '22AQTPB6406A1ZE', 'JPL GATE NO-5 SALIHABHATTA
TAMNAR RAIGARH
Fassai-20523076000006', '22AQTPB6406A1ZE', '496107', false, null),
  ('Avon Communication', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Avon Communication', 'Chhattisgarh', 'Avon Communication', 'Bus Stand ,Dharamjaigarh,Raigarh-496116', 'Chhattisgarh', '496116', '22AFJPA5194F1ZR', 'Bus Stand ,Dharamjaigarh,Raigarh-496116', '22AFJPA5194F1ZR', '496116', false, null),
  ('Balaji Mineral', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Balaji Mineral', 'Chhattisgarh', 'Balaji Mineral', 'Balaji Minerals, Jashpur Road, Pathalgaon, Jashpur,
496118', 'Chhattisgarh', '496118', '22CQSPG4381A1Z2', 'Balaji Minerals, Jashpur Road, Pathalgaon, Jashpur,
496118', '22CQSPG4381A1Z2', '496118', false, null),
  ('Behra Jalpan Grih', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Behra Jalpan Grih', 'Chhattisgarh', 'Behra Jalpan Grih', 'Bus Stand Tamnar
Raigarh', 'Chhattisgarh', '496111', '22BFDPB5019K1ZW', 'Bus Stand Tamnar
Raigarh', '22BFDPB5019K1ZW', '496111', false, null),
  ('Behra Pujan Samagri ( Basna )', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Behra Pujan Samagri ( Basna )', 'Chhattisgarh', 'Behra Pujan Samagri ( Basna )', 'Padampur Road , Basna , Mahasamund', 'Chhattisgarh', '493554', '22AUXPB8724D1ZN', 'Padampur Road , Basna , Mahasamund', '22AUXPB8724D1ZN', '493554', false, null),
  ('Diksha Enterprises', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Diksha Enterprises', 'Chhattisgarh', 'Diksha Enterprises', 'Raigarh Road Sarangarh', 'Chhattisgarh', '496001', '22BCAPK0149K1ZZ', 'Raigarh Road Sarangarh', '22BCAPK0149K1ZZ', '496001', false, null),
  ('Golu Fotwani', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Golu Fotwani', 'Chhattisgarh', 'Golu Fotwani', '16/1/18 Sindhi Colony Kharsia Dist Raigarh', 'Chhattisgarh', null, null, '16/1/18 Sindhi Colony Kharsia Dist Raigarh', null, null, false, null),
  ('Gurmukh Das Bharat Lal', (select id from route_order_route where name = 'Raigarh'), 'Other', null, 'Gurmukh Das Bharat Lal', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Kavya Dairy', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Kavya Dairy', 'Chhattisgarh', 'Kavya Dairy', 'Agrasen Choke Sarangarh
Raigarh', 'Chhattisgarh', '496445', null, 'Agrasen Choke Sarangarh
Raigarh', null, '496445', false, null),
  ('Kishna Dairy Raigarh', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Kishna Dairy Raigarh', 'Chhattisgarh', 'Kishna Dairy Raigarh', 'H.P Ga, Kotra Road
Raigarh
Mob: 9993443118
Email Id Vishudewangan07@gmail.Com', 'Chhattisgarh', null, null, 'H.P Ga, Kotra Road
Raigarh
Mob: 9993443118
Email Id Vishudewangan07@gmail.Com', null, null, false, null),
  ('Krishna Puja Samgri', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Krishna Puja Samgri', 'Chhattisgarh', 'Krishna Puja Samgri', 'Main Road Bitangipali
Basna, Mahasamund', 'Chhattisgarh', '493554', null, 'Main Road Bitangipali
Basna, Mahasamund', null, '493554', false, null),
  ('Laxmi Sales', (select id from route_order_route where name = 'Raigarh'), 'Other', null, 'Laxmi Sales', 'Chhattisgarh', 'Laxmi Sales', 'Joganipali, Saraipali,
Mahasamund', 'Chhattisgarh', '493558', '22BEXPA8555C2ZG', 'Joganipali, Saraipali,
Mahasamund', '22BEXPA8555C2ZG', '493558', false, null),
  ('Madhu Hotel', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Madhu Hotel', 'Chhattisgarh', 'Madhu Hotel', 'Sagar Pali, Sarai Pali (C.G.)', 'Chhattisgarh', null, null, 'Sagar Pali, Sarai Pali (C.G.)', null, null, false, null),
  ('Muskan Ice Cream', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Muskan Ice Cream', 'Chhattisgarh', 'Muskan Ice Cream', 'Main Road Tamnar, Raigarh', 'Chhattisgarh', null, null, 'Main Road Tamnar, Raigarh', null, null, false, null),
  ('Nemish Chand Gupta', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Nemish Chand Gupta', 'Chhattisgarh', 'Nemish Chand Gupta', 'S/o. Lt. Ful Chand Gupta,
Ward No 10, 18/2, Sonar Para, Raigarh', 'Chhattisgarh', '496001', null, 'S/o. Lt. Ful Chand Gupta,
Ward No 10, 18/2, Sonar Para, Raigarh', null, '496001', false, null),
  ('New Munna Dairy', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'New Munna Dairy', 'Chhattisgarh', 'New Munna Dairy', '667, Chhote Atarmuda,
Abhinav School Ke Pass,
Ward No. - 28, Raigarh', 'Chhattisgarh', '496001', null, '667, Chhote Atarmuda,
Abhinav School Ke Pass,
Ward No. - 28, Raigarh', null, '496001', false, null),
  ('Rahul Kumar Gupta', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Rahul Kumar Gupta', 'Chhattisgarh', 'Rahul Kumar Gupta', 'S/o Arun K Gupta, NEST (MINI)
NHAI Dhank Toll Plaza', 'Chhattisgarh', null, null, 'S/o Arun K Gupta, NEST (MINI)
NHAI Dhank Toll Plaza', null, null, false, null),
  ('Relaince Retail Ltd. Fresh, Grand Mall', (select id from route_order_route where name = 'Raigarh'), 'Other', null, 'Relaince Retail Ltd. Fresh, Grand Mall', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Relaince Retail Ltd. Fresh,Shah Complex Darogapara Raigarh', (select id from route_order_route where name = 'Raigarh'), 'Other', null, 'Relaince Retail Ltd. Fresh,Shah Complex Darogapara Raigarh', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Relaince Retail Ltd. Fresh,SK Plaza Raigarh', (select id from route_order_route where name = 'Raigarh'), 'Other', null, 'Relaince Retail Ltd. Fresh,SK Plaza Raigarh', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Rrl-Grand Mall', (select id from route_order_route where name = 'Raigarh'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Saha Complex Raigarh', (select id from route_order_route where name = 'Raigarh'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Sk Plaza Building', (select id from route_order_route where name = 'Raigarh'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Sahu Icecream & Cold Drink', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Sahu Icecream & Cold Drink', 'Chhattisgarh', 'Sahu Icecream & Cold Drink', 'Ward No 11 Vinoba City, Sariya Raigarh', 'Chhattisgarh', '496554', null, 'Ward No 11 Vinoba City, Sariya Raigarh', null, '496554', false, null),
  ('Sai Dairy & Sweets', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Sai Dairy & Sweets', 'Chhattisgarh', 'Sai Dairy & Sweets', 'Girvani Raigarh
Revati Raman Singh , S/o Jitendra Singh, Ward 8
Saraipali, Raigarh(496107)', 'Chhattisgarh', '496001', null, 'Girvani Raigarh
Revati Raman Singh , S/o Jitendra Singh, Ward 8
Saraipali, Raigarh(496107)', null, '496001', false, null),
  ('Satguru Dairy', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Satguru Dairy', 'Chhattisgarh', 'Satguru Dairy', 'Handi Chowk Raigarh', 'Chhattisgarh', '496001', null, 'Handi Chowk Raigarh', null, '496001', false, null),
  ('Shivani Pooja Samagri', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Shivani Pooja Samagri', 'Chhattisgarh', 'Shivani Pooja Samagri', 'Ward No. 12 Udiyapara Saraipali Mahasamund', 'Chhattisgarh', null, null, 'Ward No. 12 Udiyapara Saraipali Mahasamund', null, null, false, null),
  ('Shivani Sweets', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Shivani Sweets', 'Chhattisgarh', 'Shivani Sweets', 'Main Road Ward No11, Jaistambh Chowk,
Saraipali, Mahasamund', 'Chhattisgarh', '493558', null, 'Main Road Ward No11, Jaistambh Chowk,
Saraipali, Mahasamund', null, '493558', false, null),
  ('Shivshakti Trading', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Shivshakti Trading', 'Chhattisgarh', 'Shivshakti Trading', 'Sunil Kumar Sahu, 13/1 Kenwat Para1, Medinipur,
Basna, Medinipur, Baroli, Mahasamund', 'Chhattisgarh', '493554', null, 'Sunil Kumar Sahu, 13/1 Kenwat Para1, Medinipur,
Basna, Medinipur, Baroli, Mahasamund', null, '493554', false, null),
  ('Shree Ganpati Agencies', (select id from route_order_route where name = 'Raigarh'), 'Bulk', 'Bulk', 'Shree Ganpati Agencies', 'Chhattisgarh', 'Shree Ganpati Agencies', 'MG Road, Raigarh', 'Chhattisgarh', '496001', '22ARDPA9064G1Z5', 'MG Road, Raigarh', '22ARDPA9064G1Z5', '496001', false, null),
  ('Shri Mangalam Traders', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Shri Mangalam Traders', 'Chhattisgarh', 'Shri Mangalam Traders', 'WARD NO. 11, PADAMPUR ROAD,
SARAIPALI, Mahasamund, Chhattisgarh,
493558', 'Chhattisgarh', '493558', '22ACIPA3981E1Z1', 'WARD NO. 11, PADAMPUR ROAD,
SARAIPALI, Mahasamund, Chhattisgarh,
493558', '22ACIPA3981E1Z1', '493558', false, null),
  ('Sun Food Nest', (select id from route_order_route where name = 'Raigarh'), 'Other', null, 'Sun Food Nest', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Sun Food Nest Saraipali', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Sun Food Nest', 'Chhattisgarh', 'Sun Food Nest', 'Kushalpur Road Professor Colony Raipur', 'Chhattisgarh', '492001', '22BNUPP5208D1Z0', 'Kushalpur Road Professor Colony Raipur', '22BNUPP5208D1Z0', '492001', false, null),
  ('Sun Food Next', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Sun Food Nest', 'Chhattisgarh', 'Sun Food Nest', 'Kushalpur Road Professor Colony Raipur', 'Chhattisgarh', '492001', '22BNUPP5208D1Z0', 'Kushalpur Road Professor Colony Raipur', '22BNUPP5208D1Z0', '492001', false, null),
  ('Vedant Enterprise', (select id from route_order_route where name = 'Raigarh'), 'GT', null, 'Vedant Enterprise', 'Chhattisgarh', 'Vedant Enterprise', 'Infront of SBI Patrapali Kirodimal,Patrapali,Raigarh,CG-496001', 'Chhattisgarh', '496001', null, 'Infront of SBI Patrapali Kirodimal,Patrapali,Raigarh,CG-496001', null, '496001', false, null),
  ('Anmol Egg And Coldrink', (select id from route_order_route where name = 'Korba'), 'GT', null, 'Anmol Egg and Cold Drink', 'Chhattisgarh', 'Anmol Egg and Cold Drink', 'Shop no-11 2jjv lions chowk station road
champa distt-jangir', 'Chhattisgarh', '495671', null, 'Shop no-11 2jjv lions chowk station road
champa distt-jangir', null, '495671', false, null),
  ('Avi Traders', (select id from route_order_route where name = 'Korba'), 'GT', null, 'Avi Traders', 'Chhattisgarh', 'Avi Traders', 'P No-1 Word No-06,Old Bus Stand Main Road, Purani
Basti Korba 495677', 'Chhattisgarh', '495677', '22BXVPR8630Q1ZE', 'P No-1 Word No-06,Old Bus Stand Main Road, Purani
Basti Korba 495677', '22BXVPR8630Q1ZE', '495677', false, null),
  ('Babla Dairy', (select id from route_order_route where name = 'Korba'), 'GT', null, 'Babla Dairy', 'Chhattisgarh', 'Babla Dairy', 'House No. 64, Mahaveer Chowk,
Bhogaha Para, Ward No. 8,
Shivrinarayan, Janjgir - Champa', 'Chhattisgarh', '495557', null, 'House No. 64, Mahaveer Chowk,
Bhogaha Para, Ward No. 8,
Shivrinarayan, Janjgir - Champa', null, '495557', false, null),
  ('Gulsan Traders', (select id from route_order_route where name = 'Korba'), 'Other', null, 'Gulsan Traders', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Jaiswal Kirana And General Srores', (select id from route_order_route where name = 'Korba'), 'GT', null, 'Jaiswal Kirana And General Srores', 'Chhattisgarh', 'Jaiswal Kirana And General Srores', 'BARPALI, BARPALI, KORBA, Korba, Chhattisgarh, 495674', 'Chhattisgarh', null, '22AQXPJ6682Q1ZR', 'BARPALI, BARPALI, KORBA, Korba, Chhattisgarh, 495674', '22AQXPJ6682Q1ZR', null, false, null),
  ('Kalyan Enterprises', (select id from route_order_route where name = 'Korba'), 'Other', null, 'Kalyan Enterprises', 'Chhattisgarh', 'Kalyan Enterprises', 'HO NO-212/A Lalu ran colony
T. P. Nagar Korba
Dist- korba (C.G.)', 'Chhattisgarh', '495677', '22ABFFK1637B1ZY', 'HO NO-212/A Lalu ran colony
T. P. Nagar Korba
Dist- korba (C.G.)', '22ABFFK1637B1ZY', '495677', false, null),
  ('Natraj Traders', (select id from route_order_route where name = 'Korba'), 'Institutional', null, 'Natraj Traders', 'Chhattisgarh', 'Natraj Traders', 'Ground Floor
Main Road Korba
Near Banti Store
Korba', 'Chhattisgarh', '495677', '22AXSPR5702M1ZZ', 'Ground Floor
Main Road Korba
Near Banti Store
Korba', '22AXSPR5702M1ZZ', '495677', false, null),
  ('Rakesh Traders', (select id from route_order_route where name = 'Korba'), 'Other', null, 'Rakesh Traders', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Rrl-Indra Complex', (select id from route_order_route where name = 'Korba'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Rrl-Palm Mall', (select id from route_order_route where name = 'Korba'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Shaifu Dairy', (select id from route_order_route where name = 'Korba'), 'Other', null, 'Shaifu Dairy', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Skm-Shivrinarayan', (select id from route_order_route where name = 'Korba'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', 'Ward No.11, Kera Road
Shivrinarayan', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', 'Ward No.11, Kera Road
Shivrinarayan', '22AASCS8717K1ZR', '492001', false, null),
  ('Vikash Milk', (select id from route_order_route where name = 'Korba'), 'Other', null, 'Vikash Milk', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Agrawal Dairy', (select id from route_order_route where name = 'Mahasamund'), 'GT', null, 'Agrawal Dairy', 'Chhattisgarh', 'Agrawal Dairy', 'S/o. Karan Agrawal ,305, Aadarsh Nagar
Mahasamund', 'Chhattisgarh', '493445', null, 'S/o. Karan Agrawal ,305, Aadarsh Nagar
Mahasamund', null, '493445', false, null),
  ('Anil Super Market', (select id from route_order_route where name = 'Mahasamund'), 'ATP', null, 'Anil Supermarket', 'Chhattisgarh', 'Anil Supermarket', 'Main Road, Ward No. 02
Bagbahara, Mahasamund', 'Chhattisgarh', '493449', '22DCPPA5084L1ZE', 'Main Road, Ward No. 02
Bagbahara, Mahasamund', '22DCPPA5084L1ZE', '493449', false, null),
  ('Jai Pitaimata Milk Dairy', (select id from route_order_route where name = 'Mahasamund'), 'Other', null, 'Jai Pitaimata Milk Dairy', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Jigya Agency', (select id from route_order_route where name = 'Mahasamund'), 'Other', null, 'Jigya Agency', 'Chhattisgarh', 'Jigya Agency', 'Railway Station Chowk,Bagbahara Main Road,
Bagbahara, Mahasamund, Chhattishgarh
493449', 'Chhattisgarh', '493449', '22BMCPD2957A1ZS', 'Railway Station Chowk,Bagbahara Main Road,
Bagbahara, Mahasamund, Chhattishgarh
493449', '22BMCPD2957A1ZS', '493449', false, null),
  ('Om Dairy Farm', (select id from route_order_route where name = 'Mahasamund'), 'GT', null, 'Om Dairy Farm', 'Chhattisgarh', 'Om Dairy Farm', 'Baronda Chowk , Mahasamund', 'Chhattisgarh', '493445', '22AMAPY5477B2Z2', 'Baronda Chowk , Mahasamund', '22AMAPY5477B2Z2', '493445', false, null),
  ('Parag Ann Bhandar', (select id from route_order_route where name = 'Mahasamund'), 'Other', null, 'Parag Ann Bhandar', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Plant Cash Sale', (select id from route_order_route where name = 'Mahasamund'), 'Other', null, 'Plant Cash Sale', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Rrl-Mahasamund U943', (select id from route_order_route where name = 'Mahasamund'), 'MFS', 'Reliance Retail Limited', 'Reliance Retail Limited 2026-27', 'Chhattisgarh', 'Reliance Retail Limited 2026-27', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', 'Chhattisgarh', '492015', '22AABCR1718E1ZZ', 'WH GF L K Corporates Log Park Block N
Kh185/8, To, 18,185/23,to,30,185/43,to,55,Vg,
Dumartari NH 30 New Dhamtari Road Raipur,
Raipur, Chhattisgarh, 492015, ABHANPUR,', '22AABCR1718E1ZZ', '492015', false, null),
  ('Aayush Enterprise', (select id from route_order_route where name = 'Rajnandgaon'), 'ATP', null, 'Aayush Enterprise', 'Chhattisgarh', 'Aayush Enterprise', 'GANDAI ROAD, DHAMDHA, Durg,Chhattisgarh-490006', 'Chhattisgarh', '490006', '22BBJPS1743R1Z4', 'GANDAI ROAD, DHAMDHA, Durg,Chhattisgarh-490006', '22BBJPS1743R1Z4', '490006', false, null),
  ('Abhishekh Traders', (select id from route_order_route where name = 'Rajnandgaon'), 'Other', null, 'Abhishekh Traders', 'Chhattisgarh', 'Abhishekh Traders', 'Ward No. 36, Tiranga Chowk,
Rajnandgaon', 'Chhattisgarh', '491441', '22AAYPG6174F1ZI', 'Ward No. 36, Tiranga Chowk,
Rajnandgaon', '22AAYPG6174F1ZI', '491441', false, null),
  ('Ashish Dairy & Daily Needs', (select id from route_order_route where name = 'Rajnandgaon'), 'Other', null, 'Ashish Dairy & Daily Needs', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Bikaner Sweets Dongargaon', (select id from route_order_route where name = 'Rajnandgaon'), 'GT', null, 'Bikaner Sweet', 'Chhattisgarh', 'Bikaner Sweets Dongargaon', null, null, null, null, null, null, null, false, 'REVIEW: ''Bikaner Sweets Dongargaon'' not found in Tally LEDGER master (closest: ''Bikaner Sweet Dongargaon SD'', 92%). Row left unchanged - verify spelling or create this ledger in Tally.'),
  ('Chandrakar And Thakur Brother', (select id from route_order_route where name = 'Rajnandgaon'), 'GT', null, 'Chandrakar and Thakur Brother', 'Chhattisgarh', 'Chandrakar and Thakur Brother', 'Near Ice Factory, Ward No. 15,
Tulsipur, Rajnandgaon', 'Chhattisgarh', '491441', '22ADMPT0163A1Z0', 'Near Ice Factory, Ward No. 15,
Tulsipur, Rajnandgaon', '22ADMPT0163A1Z0', '491441', false, null),
  ('D-Mart Rajnandgaon Chhattisagarh', (select id from route_order_route where name = 'Rajnandgaon'), 'MFS', 'Avenue Supermarts Ltd', 'Avenue Supermarts Ltd 2026-27', 'Chhattisgarh', 'Avenue Supermarts Ltd 2026-27', 'Lakholi', 'Chhattisgarh', '492001', '22AACCA8432H1Z0', 'Lakholi', '22AACCA8432H1Z0', '492001', false, null),
  ('Jalaram Marketing', (select id from route_order_route where name = 'Rajnandgaon'), 'GT', null, 'Jalaram Marketing', 'Chhattisgarh', 'Jalaram Marketing', 'Ward No. 38, Bhawani Nagar,
Rajnandgaon', 'Chhattisgarh', '491441', '22ADLPB7089G1ZK', 'Ward No. 38, Bhawani Nagar,
Rajnandgaon', '22ADLPB7089G1ZK', '491441', false, null),
  ('Khatri Dairy', (select id from route_order_route where name = 'Rajnandgaon'), 'Other', null, 'Khatri Dairy', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Labh Shri Suppliers', (select id from route_order_route where name = 'Rajnandgaon'), 'ATP', null, 'Labh Shri Supplies', 'Chhattisgarh', 'Labh Shri Supplies', 'Tiranga Chouwk, Gang Line,
Rajnandgaon (C.G.)', 'Chhattisgarh', '491441', '22AAYPG6178K1Z3', 'Tiranga Chouwk, Gang Line,
Rajnandgaon (C.G.)', '22AAYPG6178K1Z3', '491441', false, null),
  ('Namo Traders', (select id from route_order_route where name = 'Rajnandgaon'), 'Other', null, 'Namo Traders', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Ramchand Chouthmal', (select id from route_order_route where name = 'Rajnandgaon'), 'GT', null, 'Ramchand Chouthmal', 'Chhattisgarh', 'Ramchand Chouthmal', 'Ganj Line Ward No. 24,
Bharat Mata Chowk,  Rajnandgaon', 'Chhattisgarh', '491441', '22AAMPA5605P1ZP', 'Ganj Line Ward No. 24,
Bharat Mata Chowk,  Rajnandgaon', '22AAMPA5605P1ZP', '491441', false, null),
  ('Shree Doodh Sagar', (select id from route_order_route where name = 'Rajnandgaon'), 'GT', null, 'Shree Doodh Sagar', 'Chhattisgarh', 'Shree Doodh Sagar', 'Street N0- 4, Near Sindhu Bhawan, Sindhi Colony, Lal bag,  Rajnandgaon ( Chhattisgarh)', 'Chhattisgarh', '491441', null, 'Street N0- 4, Near Sindhu Bhawan, Sindhi Colony, Lal bag,  Rajnandgaon ( Chhattisgarh)  491441', null, '491441', false, null),
  ('Shree Ram Traders', (select id from route_order_route where name = 'Rajnandgaon'), 'Other', null, 'Shree Ram Traders', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Skm-Rajnandgaon', (select id from route_order_route where name = 'Rajnandgaon'), 'MFS', 'Shubham K Mart Pvt Ltd', 'Shubham K Mart Pvt Ltd 2026-27', 'Chhattisgarh', 'Shubham K Mart Pvt Ltd 2026-27', '32MH+GMX
Dongargaon Road
Basantpur, Rajnandgaon', 'Chhattisgarh', '492001', '22AASCS8717K1ZR', '32MH+GMX
Dongargaon Road
Basantpur, Rajnandgaon', '22AASCS8717K1ZR', '492001', false, null),
  ('Komal Agencies', (select id from route_order_route where name = 'Jagdalpur'), 'Other', null, 'Komal Agencies', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Shri Ram Agency', (select id from route_order_route where name = 'Jagdalpur'), 'Other', null, 'Shri Ram Agency', 'Chhattisgarh', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Annapurna Variety', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Annapurna Variety', 'Odisha', 'Annapurna Variety', 'Jamurda, Bargarh', 'Odisha', '768028', null, 'Jamurda, Bargarh', null, '768028', true, null),
  ('Baijayanti Mala Mahapatra', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('Chakadola Store', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('Chetna Sahu', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('Dinesh Agrawal', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('Farhat Firdos', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('Janki Agro Food', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('Jitendriya Sarangi', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('Jitesh Goyel', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('Kamla Devi Agarwal', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('Kshamanidhi Nayak', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('Lilima Agency', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('Markanda Sarangi', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('Neha Biswal', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('Pradip Kumar Rath', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('S K Milk Parlour', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('Samarpan Barik', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('Shivananda Sahu', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('Shree Sai Services Private Limited Iim', (select id from route_order_route where name = 'Odisha'), 'Institutional', null, 'Shree Sai Services Private Limited IIM', 'Odisha', 'Shree Sai Services Private Limited IIM', '4285,GOSALA,Sangeetha Shoe House,, Burla,Sambalpur', 'Odisha', '768017', '21ABGCS0268L1ZB', '4285,GOSALA,Sangeetha Shoe House,, Burla,Sambalpur', '21ABGCS0268L1ZB', '768017', false, null),
  ('Sushil Kumar Agrawal', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('Tara Sweets', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('Virajinee Sao', (select id from route_order_route where name = 'Odisha'), 'Other', null, 'Tapaswini Enterprises', 'Odisha', 'Tapaswini Enterprises', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', 'Odisha', '768020', '21HSGPM2874H1ZL', 'Anand Vihar Jagruti Vihar
Burla Sambalpur', '21HSGPM2874H1ZL', '768020', true, null),
  ('Aarav Sales', (select id from route_order_route where name = 'Nagpur'), 'Other', null, 'Aarav Sales', 'Maharashtra', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Bharat Traders', (select id from route_order_route where name = 'Nagpur'), 'Other', null, 'Bharat Traders', 'Maharashtra', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Harsh Vegetable', (select id from route_order_route where name = 'Nagpur'), 'Other', null, 'Harsh Vegetable', 'Maharashtra', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Kanhaiya Dairy House', (select id from route_order_route where name = 'Nagpur'), 'Other', null, 'Kanhaiya Dairy House', 'Maharashtra', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Regundwar Trading', (select id from route_order_route where name = 'Nagpur'), 'Other', null, 'Regundwar Trading', 'Maharashtra', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Sharma Doodh Dairy', (select id from route_order_route where name = 'Nagpur'), 'Other', null, 'Sharma Doodh Dairy', 'Maharashtra', null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Baba Nati Traders', (select id from route_order_route where name = 'Other States'), 'Other', null, 'Baba Nati Traders', null, null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Gauri Shankar & Sons', (select id from route_order_route where name = 'Other States'), 'Other', null, 'Gauri Shankar & Sons', null, null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Gravy Foods and Beverages', (select id from route_order_route where name = 'Other States'), 'Other', null, 'Gravy Foods and Beverages', null, null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Gupta Traders', (select id from route_order_route where name = 'Other States'), 'Other', null, 'Gupta Traders', null, null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Gurumukh Das Bharat Lal', (select id from route_order_route where name = 'Other States'), 'GT', null, 'Gurumukh Das Bharat Lal', 'Chhattisgarh', 'Gurumukh Das Bharat Lal', 'hatri bazar, purani hatri, raigarh, Raigarh', 'Chhattisgarh', '496001', '22AAHPW1174A1Z3', 'hatri bazar, purani hatri, raigarh, Raigarh', '22AAHPW1174A1Z3', '496001', false, null),
  ('Kapil Enterprises', (select id from route_order_route where name = 'Other States'), 'Other', null, 'Kapil Enterprises', null, null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Maa Vaishno Traders', (select id from route_order_route where name = 'Other States'), 'Other', null, 'Maa Vaishno Traders', null, null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Mansukh Agency', (select id from route_order_route where name = 'Other States'), 'Other', null, 'Mansukh Agency', null, null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Mohan Zarda Store', (select id from route_order_route where name = 'Other States'), 'Other', null, 'Mohan Zarda Store', null, null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Quality Distributers', (select id from route_order_route where name = 'Other States'), 'Other', null, 'Quality Distributers', null, null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Rohit Enterprises', (select id from route_order_route where name = 'Other States'), 'Other', null, 'Rohit Enterprises', null, null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Shri Khatu Shyam Ji Traders', (select id from route_order_route where name = 'Other States'), 'Other', null, 'Shri Khatu Shyam Ji Traders', null, null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Shyam & Sons', (select id from route_order_route where name = 'Other States'), 'Other', null, 'Shyam & Sons', null, null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('SK Agencies', (select id from route_order_route where name = 'Other States'), 'Other', null, 'SK Agencies', null, null, null, null, null, null, null, null, null, false, 'On a route tab but not in the Distributor Master: check the Tally ledger, address and channel.'),
  ('Apna Mart Avanti Vihar Raipur', null, 'Other', null, 'Apna  Mart', null, 'Apna  Mart', null, null, null, null, null, null, null, false, 'REVIEW: ''Apna Mart'' not found in Tally LEDGER master (closest: ''Anantra Mart'', 76%). Row left unchanged - verify spelling or create this ledger in Tally.'),
  ('Maira Resort Balaghat', null, 'Institutional', null, 'Maira Resort Balaghat', null, 'Maira Resort Balaghat', null, null, null, null, null, null, null, false, 'REVIEW: ''Maira Resort Balaghat'' not found in Tally LEDGER master (closest: ''Manoj Mishra Imprest A/c'', 53%). Row left unchanged - verify spelling or create this ledger in Tally.'),
  ('Prashant Dhariwal', null, 'Other', null, 'Prashant Dhariwal', 'Chhattisgarh', 'Prashant Dhariwal', null, 'Chhattisgarh', '492001', null, null, null, '492001', false, null);
