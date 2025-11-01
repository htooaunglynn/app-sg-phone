-- MySQL dump 10.13  Distrib 9.4.0, for macos15.4 (arm64)
--
-- Host: localhost    Database: singapore_phone_db
-- ------------------------------------------------------
-- Server version	9.4.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `backup_table`
--

DROP TABLE IF EXISTS `backup_table`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `backup_table` (
  `Id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Phone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_file` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Original PDF filename',
  `extracted_metadata` text COLLATE utf8mb4_unicode_ci COMMENT 'JSON metadata from PDF extraction',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
  `CompanyName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `PhysicalAddress` text COLLATE utf8mb4_unicode_ci,
  `Email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Website` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Email` (`Email`),
  KEY `idx_phone` (`Phone`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_source_file` (`source_file`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Immutable table for storing raw PDF data';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `check_table`
--

DROP TABLE IF EXISTS `check_table`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `check_table` (
  `Id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `numeric_id` int DEFAULT NULL COMMENT 'Extracted numeric portion from Id column',
  `Phone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Status` tinyint(1) DEFAULT NULL COMMENT 'true for Singapore phone, false for non-Singapore',
  `CompanyName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `PhysicalAddress` text COLLATE utf8mb4_unicode_ci,
  `Email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Website` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `unique_email` (`Email`),
  KEY `idx_phone` (`Phone`),
  KEY `idx_status` (`Status`),
  KEY `idx_email` (`Email`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_updated_at` (`updated_at`),
  KEY `idx_company_name` (`CompanyName`),
  KEY `idx_numeric_id` (`numeric_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Editable table for validated phone data with company information';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `schema_migrations`
--

DROP TABLE IF EXISTS `schema_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migrations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `applied_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `migration_name` (`migration_name`),
  KEY `idx_migration_name` (`migration_name`),
  KEY `idx_applied_at` (`applied_at`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tracks applied database migrations';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `uploaded_files`
--

DROP TABLE IF EXISTS `uploaded_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `uploaded_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `original_filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Original filename as uploaded',
  `stored_filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Unique filename in storage',
  `file_size` bigint NOT NULL COMMENT 'File size in bytes',
  `file_type` enum('pdf','excel') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pdf' COMMENT 'File type to distinguish between PDF and Excel files',
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SHA-256 checksum for integrity',
  `upload_timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When file was uploaded',
  `processing_status` enum('pending','processed','failed','archived') COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT 'Processing status',
  `records_extracted` int DEFAULT '0' COMMENT 'Number of records extracted from file',
  `worksheets_processed` int DEFAULT '0' COMMENT 'Number of worksheets processed for Excel files',
  `extraction_report` text COLLATE utf8mb4_unicode_ci COMMENT 'Detailed processing reports for Excel files',
  `duplicates_skipped` int DEFAULT '0' COMMENT 'Number of duplicate records skipped during processing',
  `duplicate_percentage` decimal(5,2) DEFAULT '0.00' COMMENT 'Percentage of records that were duplicates',
  `duplicate_handling_status` enum('unknown','no_duplicates_found','duplicates_skipped','storage_failed') COLLATE utf8mb4_unicode_ci DEFAULT 'unknown' COMMENT 'Status of duplicate handling for this file',
  `processed_at` timestamp NULL DEFAULT NULL COMMENT 'When processing completed',
  PRIMARY KEY (`id`),
  UNIQUE KEY `stored_filename` (`stored_filename`),
  KEY `idx_stored_filename` (`stored_filename`),
  KEY `idx_upload_timestamp` (`upload_timestamp`),
  KEY `idx_processing_status` (`processing_status`),
  KEY `idx_original_filename` (`original_filename`),
  KEY `idx_file_type` (`file_type`)
) ENGINE=InnoDB AUTO_INCREMENT=149 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='File metadata tracking for uploaded PDFs';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_logins`
--

DROP TABLE IF EXISTS `user_logins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_logins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `login_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `ip_address` varchar(45) DEFAULT NULL,
  `device` varchar(200) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `result` enum('success','failed') DEFAULT 'success',
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `user_logins_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `status` enum('active','inactive','banned') DEFAULT 'active',
  `device` varchar(200) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `last_seen` datetime DEFAULT NULL,
  `login_token` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-01 16:44:22
