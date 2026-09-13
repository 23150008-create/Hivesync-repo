-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: hivesync_db
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `tbl_audit_trail`
--

DROP TABLE IF EXISTS `tbl_audit_trail`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbl_audit_trail` (
  `audit_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `user_name` varchar(150) DEFAULT NULL,
  `module` varchar(100) DEFAULT NULL,
  `action` varchar(255) DEFAULT NULL,
  `details` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`audit_id`)
) ENGINE=InnoDB AUTO_INCREMENT=78 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_audit_trail`
--

LOCK TABLES `tbl_audit_trail` WRITE;
/*!40000 ALTER TABLE `tbl_audit_trail` DISABLE KEYS */;
INSERT INTO `tbl_audit_trail` VALUES (55,1,'System Admin','Inventory','Add Product','Added product: Organic Brown Rice','2026-06-22 13:43:15'),(56,1,'System Admin','Vendor Management','Add Vendor','Added vendor: BFATC Supplier','2026-06-22 13:44:29'),(57,1,'System Admin','Inventory','Update Product','Updated product: Organic Brown Rice','2026-06-22 13:44:40'),(58,1,'System Admin','Authentication','Logout','System Admin logged out','2026-06-22 13:49:27'),(59,1,'System Admin','Authentication','Login','System Admin logged in as Admin','2026-06-22 13:49:31'),(60,1,'System Admin','Point Of Sale','Checkout','Completed sale TRX-20260622154948 with total amount ₱500.00','2026-06-22 13:49:48'),(61,1,'System Admin','Point Of Sale','Checkout','Completed sale TRX-20260622154952 with total amount ₱500.00','2026-06-22 13:49:52'),(62,1,'System Admin','Point Of Sale','Checkout','Completed sale TRX-20260622155026 with total amount ₱500.00','2026-06-22 13:50:26'),(63,1,'System Admin','Point Of Sale','Checkout','Completed sale TRX-20260622155220 with total amount ₱500.00','2026-06-22 13:52:20'),(64,1,'System Admin','Point Of Sale','Checkout','Completed sale TRX-20260622155903 with total amount ₱500.00','2026-06-22 13:59:03'),(65,1,'System Admin','Point Of Sale','Checkout','Completed sale TRX-20260622160228 with total amount ₱500.00','2026-06-22 14:02:28'),(66,1,'System Admin','Authentication','Logout','System Admin logged out','2026-06-22 14:03:25'),(67,1,'System Admin','Authentication','Login','System Admin logged in as Admin','2026-06-22 14:44:29'),(68,1,'System Admin','Settings','Database Backup','Created database backup hivesync_backup_2026-06-22_16-58-08.sql','2026-06-22 14:58:08'),(69,1,'System Admin','Authentication','Login','System Admin logged in as Admin','2026-06-22 16:41:31'),(70,1,'System Admin','Point Of Sale','Checkout','Completed sale TRX-20260622184843 with total amount ₱1500.00','2026-06-22 16:48:43'),(71,1,'System Admin','Authentication','Logout','System Admin logged out','2026-06-22 16:50:56'),(72,7,'Jason','Authentication','Login','Jason logged in as Tourism Admin','2026-06-22 16:51:14'),(73,7,'Jason','Authentication','Logout','Jason logged out','2026-06-22 16:51:47'),(74,1,'System Admin','Authentication','Login','System Admin logged in as Admin','2026-06-22 16:51:52'),(75,1,'System Admin','Authentication','Logout','System Admin logged out','2026-06-23 04:21:45'),(76,1,'System Admin','Authentication','Login','System Admin logged in as Admin','2026-06-23 04:23:17'),(77,1,'System Admin','Point Of Sale','Checkout','Completed sale TRX-20260623062430 with total amount ₱500.00','2026-06-23 04:24:30');
/*!40000 ALTER TABLE `tbl_audit_trail` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_category`
--

DROP TABLE IF EXISTS `tbl_category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbl_category` (
  `category_id` int(11) NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`category_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_category`
--

LOCK TABLES `tbl_category` WRITE;
/*!40000 ALTER TABLE `tbl_category` DISABLE KEYS */;
INSERT INTO `tbl_category` VALUES (1,'Organic Produce','2026-06-20 11:22:46'),(2,'Processed Goods','2026-06-20 11:22:46'),(3,'Beverages','2026-06-20 11:22:46'),(4,'Handicrafts','2026-06-20 11:22:46'),(5,'Honey Products','2026-06-20 11:22:46'),(6,'Souvenirs','2026-06-20 11:22:46'),(7,'Local Delicacies','2026-06-20 11:22:46'),(8,'Fresh Harvest','2026-06-20 11:22:46'),(9,'Other','2026-06-20 11:22:46');
/*!40000 ALTER TABLE `tbl_category` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_delivery`
--

DROP TABLE IF EXISTS `tbl_delivery`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbl_delivery` (
  `delivery_id` int(11) NOT NULL AUTO_INCREMENT,
  `vendor_id` int(11) DEFAULT NULL,
  `items_count` int(11) DEFAULT 0,
  `amount` decimal(10,2) DEFAULT 0.00,
  `driver` varchar(100) DEFAULT NULL,
  `delivery_date` date DEFAULT NULL,
  `status` enum('Pending','In Transit','Delivered','Delayed') DEFAULT 'Pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`delivery_id`),
  KEY `vendor_id` (`vendor_id`),
  CONSTRAINT `tbl_delivery_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `tbl_vendor` (`vendor_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_delivery`
--

LOCK TABLES `tbl_delivery` WRITE;
/*!40000 ALTER TABLE `tbl_delivery` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_delivery` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_inv`
--

DROP TABLE IF EXISTS `tbl_inv`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbl_inv` (
  `product_id` int(11) NOT NULL AUTO_INCREMENT,
  `product_name` varchar(100) NOT NULL,
  `sku` varchar(50) DEFAULT NULL,
  `category_id` int(11) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `quantity` int(11) DEFAULT 0,
  `unit_type` varchar(30) DEFAULT 'pcs',
  `reorder_level` int(11) DEFAULT 0,
  `unit` varchar(30) DEFAULT NULL,
  `supplier_price` decimal(10,2) DEFAULT 0.00,
  `selling_price` decimal(10,2) DEFAULT 0.00,
  `expiry_date` date DEFAULT NULL,
  `product_image` varchar(255) DEFAULT NULL,
  `vendor_id` int(11) DEFAULT NULL,
  `status` enum('In Stock','Low Stock','Out of Stock','Archived') DEFAULT 'In Stock',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`product_id`),
  UNIQUE KEY `sku` (`sku`),
  KEY `vendor_id` (`vendor_id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `tbl_inv_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `tbl_vendor` (`vendor_id`),
  CONSTRAINT `tbl_inv_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `tbl_category` (`category_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_inv`
--

LOCK TABLES `tbl_inv` WRITE;
/*!40000 ALTER TABLE `tbl_inv` DISABLE KEYS */;
INSERT INTO `tbl_inv` VALUES (6,'Organic Brown Rice','RICE-001',1,'Organic Produce',40,'bag',10,'pcs',200.00,500.00,'2026-08-31','BrownRice_1782135795.png',3,'','2026-06-22 13:43:15','2026-06-23 04:24:30');
/*!40000 ALTER TABLE `tbl_inv` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_monitor`
--

DROP TABLE IF EXISTS `tbl_monitor`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbl_monitor` (
  `log_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `action` text NOT NULL,
  `module` varchar(100) DEFAULT NULL,
  `severity` enum('Info','Warning','Danger') DEFAULT 'Info',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`log_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `tbl_monitor_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `tbl_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_monitor`
--

LOCK TABLES `tbl_monitor` WRITE;
/*!40000 ALTER TABLE `tbl_monitor` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_monitor` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_pos`
--

DROP TABLE IF EXISTS `tbl_pos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbl_pos` (
  `pos_id` int(11) NOT NULL AUTO_INCREMENT,
  `transaction_code` varchar(50) NOT NULL,
  `cashier_id` int(11) DEFAULT NULL,
  `total_amount` decimal(10,2) DEFAULT 0.00,
  `discount` decimal(10,2) DEFAULT 0.00,
  `payment_amount` decimal(10,2) DEFAULT 0.00,
  `change_amount` decimal(10,2) DEFAULT 0.00,
  `transaction_date` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`pos_id`),
  UNIQUE KEY `transaction_code` (`transaction_code`),
  KEY `cashier_id` (`cashier_id`),
  CONSTRAINT `tbl_pos_ibfk_1` FOREIGN KEY (`cashier_id`) REFERENCES `tbl_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_pos`
--

LOCK TABLES `tbl_pos` WRITE;
/*!40000 ALTER TABLE `tbl_pos` DISABLE KEYS */;
INSERT INTO `tbl_pos` VALUES (24,'TRX-20260622154948',1,500.00,0.00,500.00,0.00,'2026-06-22 13:49:48'),(25,'TRX-20260622154952',1,500.00,0.00,500.00,0.00,'2026-06-22 13:49:52'),(26,'TRX-20260622155026',1,500.00,0.00,500.00,0.00,'2026-06-22 13:50:26'),(27,'TRX-20260622155220',1,500.00,0.00,500.00,0.00,'2026-06-22 13:52:20'),(28,'TRX-20260622155903',1,500.00,0.00,500.00,0.00,'2026-06-22 13:59:03'),(29,'TRX-20260622160228',1,500.00,0.00,500.00,0.00,'2026-06-22 14:02:28'),(30,'TRX-20260622184843',1,1500.00,0.00,3000.00,1500.00,'2026-06-22 16:48:43'),(31,'TRX-20260623062430',1,500.00,0.00,500.00,0.00,'2026-06-23 04:24:30');
/*!40000 ALTER TABLE `tbl_pos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_pos_items`
--

DROP TABLE IF EXISTS `tbl_pos_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbl_pos_items` (
  `item_id` int(11) NOT NULL AUTO_INCREMENT,
  `pos_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  PRIMARY KEY (`item_id`),
  KEY `pos_id` (`pos_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `tbl_pos_items_ibfk_1` FOREIGN KEY (`pos_id`) REFERENCES `tbl_pos` (`pos_id`),
  CONSTRAINT `tbl_pos_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `tbl_inv` (`product_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_pos_items`
--

LOCK TABLES `tbl_pos_items` WRITE;
/*!40000 ALTER TABLE `tbl_pos_items` DISABLE KEYS */;
INSERT INTO `tbl_pos_items` VALUES (1,24,6,1,500.00,500.00),(2,25,6,1,500.00,500.00),(3,26,6,1,500.00,500.00),(4,27,6,1,500.00,500.00),(5,28,6,1,500.00,500.00),(6,29,6,1,500.00,500.00),(7,30,6,3,500.00,1500.00),(8,31,6,1,500.00,500.00);
/*!40000 ALTER TABLE `tbl_pos_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_price_history`
--

DROP TABLE IF EXISTS `tbl_price_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbl_price_history` (
  `history_id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `product_name` varchar(150) DEFAULT NULL,
  `old_supplier_price` decimal(10,2) DEFAULT NULL,
  `new_supplier_price` decimal(10,2) DEFAULT NULL,
  `old_selling_price` decimal(10,2) DEFAULT NULL,
  `new_selling_price` decimal(10,2) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`history_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_price_history`
--

LOCK TABLES `tbl_price_history` WRITE;
/*!40000 ALTER TABLE `tbl_price_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_price_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_report`
--

DROP TABLE IF EXISTS `tbl_report`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbl_report` (
  `report_id` int(11) NOT NULL AUTO_INCREMENT,
  `report_type` varchar(100) NOT NULL,
  `generated_by` int(11) DEFAULT NULL,
  `date_from` date DEFAULT NULL,
  `date_to` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`report_id`),
  KEY `generated_by` (`generated_by`),
  CONSTRAINT `tbl_report_ibfk_1` FOREIGN KEY (`generated_by`) REFERENCES `tbl_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_report`
--

LOCK TABLES `tbl_report` WRITE;
/*!40000 ALTER TABLE `tbl_report` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_report` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_tourism`
--

DROP TABLE IF EXISTS `tbl_tourism`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbl_tourism` (
  `tourism_id` int(11) NOT NULL AUTO_INCREMENT,
  `activity_name` varchar(100) NOT NULL,
  `guide_name` varchar(100) DEFAULT NULL,
  `visitors` int(11) DEFAULT 0,
  `capacity` int(11) DEFAULT 0,
  `revenue` decimal(10,2) DEFAULT 0.00,
  `schedule_date` date DEFAULT NULL,
  `schedule_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `status` enum('Active','Upcoming','Completed','Cancelled') DEFAULT 'Upcoming',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`tourism_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_tourism`
--

LOCK TABLES `tbl_tourism` WRITE;
/*!40000 ALTER TABLE `tbl_tourism` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_tourism` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_user`
--

DROP TABLE IF EXISTS `tbl_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbl_user` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(50) NOT NULL DEFAULT 'Staff',
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `last_login` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_user`
--

LOCK TABLES `tbl_user` WRITE;
/*!40000 ALTER TABLE `tbl_user` DISABLE KEYS */;
INSERT INTO `tbl_user` VALUES (1,'System Admin','admin@hivesync.com','$2y$10$jnZoAzPHdPqX4QbKP3b0MuIMEHoAxaO1v3pp7HsXj8CWuUnVDRccO','Admin','Active','2026-06-23 12:23:17','2026-06-20 07:24:31'),(3,'Juan Dela Cruz Jr.','juan@gmail.com','$2y$10$30SYa4qNYWmsY5yL11FRDeJspLFTBWpsASv8TtlH/lLD6YqJHBzZy','Staff','Active','2026-06-21 21:47:35','2026-06-20 11:02:37'),(4,'Zhandrex Nisperos','TouristStaff@gmail.com','$2y$10$CRyEeDWf7U27olHjmvNATu9jDX4g8qJy0JOIINBT6tUsrOriwDY/G','Tourism Staff','Active','2026-06-21 21:47:03','2026-06-21 12:12:40'),(5,'Meow Delacruz','meow@gmail.com','$2y$10$f57yoa42nh7wm8f9ccadAeA/cMvGsw59QCIeuITx2As/fSn73qMte','Audit','Active',NULL,'2026-06-22 11:35:35'),(6,'steph curry','steph@gmail.com','$2y$10$dLl5Rex6f4a2j5B.dHQFOO2rxI4R1BRGSqBxSqJH7ou9HbiBboq6i','Tourism Admin','Active',NULL,'2026-06-22 11:38:49'),(7,'Jason','json@gmail.com','$2y$10$Ye/bafgcTbJ1zwdkDcJsVu85pUzibUzrIiRkwUQxxG2ZKBB4X/HT.','Tourism Admin','Active','2026-06-23 00:51:14','2026-06-22 16:50:49');
/*!40000 ALTER TABLE `tbl_user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_vendor`
--

DROP TABLE IF EXISTS `tbl_vendor`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbl_vendor` (
  `vendor_id` int(11) NOT NULL AUTO_INCREMENT,
  `vendor_name` varchar(100) NOT NULL,
  `contact_person` varchar(100) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`vendor_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_vendor`
--

LOCK TABLES `tbl_vendor` WRITE;
/*!40000 ALTER TABLE `tbl_vendor` DISABLE KEYS */;
INSERT INTO `tbl_vendor` VALUES (3,'BFATC Supplier','Jeff Chan','09171234567','SFC','Active','2026-06-22 13:44:29');
/*!40000 ALTER TABLE `tbl_vendor` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-23 12:29:46
