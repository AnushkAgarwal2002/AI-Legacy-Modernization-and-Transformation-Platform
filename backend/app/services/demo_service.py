"""
Demo project service — provides a built-in realistic legacy application.
"""
from typing import List, Dict, Any

# A realistic legacy Java/Spring MVC monolith with known modernization issues
DEMO_FILES: List[Dict[str, Any]] = []


def _f(path: str, content: str) -> Dict[str, Any]:
    return {
        "path": path,
        "name": path.split("/")[-1],
        "content": content,
        "size_bytes": len(content.encode("utf-8")),
        "is_binary": False,
        "is_supported": True,
    }


DEMO_FILES = [
    # ─── pom.xml ──────────────────────────────────────────────────────────────
    _f("pom.xml", """<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.acme</groupId>
    <artifactId>inventory-system</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <packaging>war</packaging>

    <name>ACME Inventory Management System</name>

    <properties>
        <java.version>1.7</java.version>
        <spring.version>3.2.18.RELEASE</spring.version>
        <hibernate.version>4.3.11.Final</hibernate.version>
        <log4j.version>1.2.17</log4j.version>
    </properties>

    <dependencies>
        <!-- Spring Framework - OUTDATED: 3.2.x EOL since 2016 -->
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-webmvc</artifactId>
            <version>${spring.version}</version>
        </dependency>
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-jdbc</artifactId>
            <version>${spring.version}</version>
        </dependency>

        <!-- Hibernate - OUTDATED: 4.x EOL -->
        <dependency>
            <groupId>org.hibernate</groupId>
            <artifactId>hibernate-core</artifactId>
            <version>${hibernate.version}</version>
        </dependency>

        <!-- Log4j 1.x - CRITICAL SECURITY RISK: abandoned, CVE-2019-17571 -->
        <dependency>
            <groupId>log4j</groupId>
            <artifactId>log4j</artifactId>
            <version>${log4j.version}</version>
        </dependency>

        <!-- Commons collections - CRITICAL: CVE-2015-7501 -->
        <dependency>
            <groupId>commons-collections</groupId>
            <artifactId>commons-collections</artifactId>
            <version>3.2.1</version>
        </dependency>

        <!-- Servlet API - old version -->
        <dependency>
            <groupId>javax.servlet</groupId>
            <artifactId>servlet-api</artifactId>
            <version>2.5</version>
            <scope>provided</scope>
        </dependency>

        <!-- MySQL connector - OUTDATED -->
        <dependency>
            <groupId>mysql</groupId>
            <artifactId>mysql-connector-java</artifactId>
            <version>5.1.47</version>
        </dependency>

        <!-- JSTL -->
        <dependency>
            <groupId>javax.servlet</groupId>
            <artifactId>jstl</artifactId>
            <version>1.2</version>
        </dependency>

        <!-- Jackson - OUTDATED: 1.x -->
        <dependency>
            <groupId>org.codehaus.jackson</groupId>
            <artifactId>jackson-mapper-asl</artifactId>
            <version>1.9.13</version>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>2.5.1</version>
                <configuration>
                    <source>1.7</source>
                    <target>1.7</target>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-war-plugin</artifactId>
                <version>2.2</version>
            </plugin>
        </plugins>
    </build>
</project>
"""),

    # ─── Main Controller ──────────────────────────────────────────────────────
    _f("src/main/java/com/acme/inventory/controller/InventoryController.java", """package com.acme.inventory.controller;

import com.acme.inventory.dao.InventoryDAO;
import com.acme.inventory.model.Product;
import com.acme.inventory.model.Order;
import com.acme.inventory.util.DatabaseUtil;
import com.acme.inventory.util.EmailSender;
import org.apache.log4j.Logger;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.ui.ModelMap;

import java.sql.*;
import java.util.*;

/**
 * Main controller for inventory management.
 * TODO: This class has grown too large - needs refactoring
 * Last modified: March 2015
 */
@Controller
public class InventoryController {

    // Hard-coded logger - should use injection
    private static final Logger log = Logger.getLogger(InventoryController.class);

    // Hard-coded database credentials - SECURITY ISSUE
    private static final String DB_URL = "jdbc:mysql://localhost:3306/inventory_db";
    private static final String DB_USER = "root";
    private static final String DB_PASS = "admin123";  // NEVER commit passwords

    // Direct DAO instantiation - breaks testability
    private InventoryDAO inventoryDAO = new InventoryDAO();

    // Hard-coded SMTP config - SECURITY ISSUE
    private static final String SMTP_HOST = "mail.acme-internal.com";
    private static final String SMTP_USER = "system@acme.com";
    private static final String SMTP_PASS = "smtp_password_2014";

    // No pagination - loads ALL products into memory
    @RequestMapping(value = "/inventory", method = RequestMethod.GET)
    public String listInventory(ModelMap model) {
        log.info("Loading ALL inventory items");
        try {
            // Direct JDBC inside controller - no separation of concerns
            Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);
            Statement stmt = conn.createStatement();
            ResultSet rs = stmt.executeQuery("SELECT * FROM products");  // SQL injection risk if parameterized incorrectly
            List<Product> products = new ArrayList<Product>();
            while (rs.next()) {
                Product p = new Product();
                p.setId(rs.getInt("id"));
                p.setName(rs.getString("name"));
                p.setQuantity(rs.getInt("quantity"));
                p.setPrice(rs.getDouble("price"));
                p.setCategory(rs.getString("category"));
                products.add(p);
            }
            // Resources never closed - connection leak!
            model.addAttribute("products", products);
        } catch (Exception e) {
            // Swallowed exception - no user feedback
            log.error("Error loading inventory: " + e.getMessage());
        }
        return "inventory/list";
    }

    @RequestMapping(value = "/inventory/search", method = RequestMethod.GET)
    public String searchInventory(@RequestParam String query, ModelMap model) {
        try {
            Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);
            Statement stmt = conn.createStatement();
            // CRITICAL SQL INJECTION VULNERABILITY
            String sql = "SELECT * FROM products WHERE name LIKE '%" + query + "%' OR category = '" + query + "'";
            ResultSet rs = stmt.executeQuery(sql);
            List<Product> results = new ArrayList<Product>();
            while (rs.next()) {
                Product p = new Product();
                p.setId(rs.getInt("id"));
                p.setName(rs.getString("name"));
                p.setQuantity(rs.getInt("quantity"));
                p.setPrice(rs.getDouble("price"));
                results.add(p);
            }
            model.addAttribute("products", results);
        } catch (SQLException e) {
            // Empty catch block
        }
        return "inventory/list";
    }

    @RequestMapping(value = "/order/create", method = RequestMethod.POST)
    public String createOrder(@ModelAttribute Order order, ModelMap model) {
        // No input validation
        // No transaction management
        // No error handling
        inventoryDAO.saveOrder(order);

        // Business logic mixed into controller
        if (order.getQuantity() > 100) {
            // Hard-coded business rule
            order.setDiscount(0.10);
        }

        // Direct email sending from controller
        sendOrderConfirmation(order);

        // Synchronous inventory update - blocks request thread
        updateInventorySync(order);

        model.addAttribute("success", true);
        return "order/confirmation";
    }

    // Business logic in controller - should be in service layer
    private void updateInventorySync(Order order) {
        try {
            Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);
            // No transaction - partial updates possible
            Statement stmt = conn.createStatement();
            stmt.execute("UPDATE products SET quantity = quantity - " + order.getQuantity()
                + " WHERE id = " + order.getProductId());  // SQL injection
            // Connection never closed
        } catch (Exception e) {
            log.error("Inventory update failed silently: " + e);
            // Silent failure - inventory may be incorrect
        }
    }

    // Email sending in controller - violates SRP
    private void sendOrderConfirmation(Order order) {
        try {
            EmailSender.send(SMTP_HOST, SMTP_USER, SMTP_PASS,
                order.getCustomerEmail(), "Order Confirmed", buildEmailBody(order));
        } catch (Exception e) {
            // Silently swallowed - customer may not receive confirmation
        }
    }

    private String buildEmailBody(Order order) {
        // String concatenation for HTML - XSS risk
        return "<html><body>Your order #" + order.getId() + " for "
            + order.getQuantity() + " x " + order.getProductName()
            + " has been confirmed.</body></html>";
    }

    // Report generation - no streaming, loads all data into memory
    @RequestMapping(value = "/reports/monthly", method = RequestMethod.GET)
    public String monthlyReport(ModelMap model) {
        List<Order> allOrders = new ArrayList<Order>();
        try {
            Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);
            ResultSet rs = conn.createStatement().executeQuery(
                "SELECT * FROM orders WHERE MONTH(created_at) = MONTH(NOW())"
            );
            while (rs.next()) {
                Order o = new Order();
                o.setId(rs.getInt("id"));
                o.setProductId(rs.getInt("product_id"));
                o.setQuantity(rs.getInt("quantity"));
                o.setTotalPrice(rs.getDouble("total_price"));
                allOrders.add(o);
            }
        } catch (Exception e) {
            log.error(e);
        }

        // In-memory calculation - could OOM for large datasets
        double totalRevenue = 0;
        for (Order o : allOrders) {
            totalRevenue += o.getTotalPrice();
        }
        model.addAttribute("orders", allOrders);
        model.addAttribute("totalRevenue", totalRevenue);
        return "reports/monthly";
    }
}
"""),

    # ─── InventoryDAO ─────────────────────────────────────────────────────────
    _f("src/main/java/com/acme/inventory/dao/InventoryDAO.java", """package com.acme.inventory.dao;

import com.acme.inventory.model.Product;
import com.acme.inventory.model.Order;
import org.apache.log4j.Logger;

import java.sql.*;
import java.util.*;

/**
 * Data Access Object for inventory operations.
 * Uses raw JDBC - no ORM despite Hibernate being on classpath.
 * All methods open their own connections - connection leak risk.
 */
public class InventoryDAO {

    private static final Logger log = Logger.getLogger(InventoryDAO.class);

    // Duplicated connection config (also in Controller) - no DRY principle
    private static final String DB_URL = "jdbc:mysql://localhost:3306/inventory_db";
    private static final String DB_USER = "root";
    private static final String DB_PASS = "admin123";

    public List<Product> findAll() {
        List<Product> products = new ArrayList<Product>();
        Connection conn = null;
        try {
            conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);
            PreparedStatement ps = conn.prepareStatement("SELECT * FROM products ORDER BY id");
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                products.add(mapProduct(rs));
            }
        } catch (SQLException e) {
            log.error("findAll failed", e);
        }
        // finally block missing - connection leak
        return products;
    }

    public Product findById(int id) {
        try {
            Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);
            PreparedStatement ps = conn.prepareStatement("SELECT * FROM products WHERE id=?");
            ps.setInt(1, id);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                return mapProduct(rs);
            }
        } catch (Exception e) {
            // Swallowed
        }
        return null;
    }

    public void saveProduct(Product p) {
        try {
            Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);
            if (p.getId() == 0) {
                PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO products (name, quantity, price, category, created_at) VALUES (?,?,?,?,NOW())");
                ps.setString(1, p.getName());
                ps.setInt(2, p.getQuantity());
                ps.setDouble(3, p.getPrice());
                ps.setString(4, p.getCategory());
                ps.execute();
            } else {
                PreparedStatement ps = conn.prepareStatement(
                    "UPDATE products SET name=?, quantity=?, price=?, category=? WHERE id=?");
                ps.setString(1, p.getName());
                ps.setInt(2, p.getQuantity());
                ps.setDouble(3, p.getPrice());
                ps.setString(4, p.getCategory());
                ps.setInt(5, p.getId());
                ps.execute();
            }
            // No conn.close() - connection leak
        } catch (Exception e) {
            log.error("Save product failed: " + e.getMessage());
            // No transaction rollback
        }
    }

    public void saveOrder(Order order) {
        Connection conn = null;
        try {
            conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);
            PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO orders (product_id, quantity, customer_email, total_price, discount, created_at) "
                + "VALUES (?,?,?,?,?,NOW())");
            ps.setInt(1, order.getProductId());
            ps.setInt(2, order.getQuantity());
            ps.setString(3, order.getCustomerEmail());
            ps.setDouble(4, order.getTotalPrice());
            ps.setDouble(5, order.getDiscount());
            ps.execute();
        } catch (Exception e) {
            log.error("saveOrder failed", e);
        } finally {
            // Only here is conn closed - inconsistent pattern
            if (conn != null) {
                try { conn.close(); } catch (SQLException ignored) {}
            }
        }
    }

    private Product mapProduct(ResultSet rs) throws SQLException {
        Product p = new Product();
        p.setId(rs.getInt("id"));
        p.setName(rs.getString("name"));
        p.setQuantity(rs.getInt("quantity"));
        p.setPrice(rs.getDouble("price"));
        p.setCategory(rs.getString("category"));
        return p;
    }
}
"""),

    # ─── Product model ────────────────────────────────────────────────────────
    _f("src/main/java/com/acme/inventory/model/Product.java", """package com.acme.inventory.model;

import java.io.Serializable;

/**
 * Product domain model.
 * Note: no validation annotations, no builder pattern, mutable fields.
 */
public class Product implements Serializable {
    // No serialVersionUID - serialization risk
    private int id;
    private String name;
    private int quantity;
    private double price;  // Should be BigDecimal for monetary values
    private String category;
    // No audit fields (createdAt, updatedAt, createdBy)
    // No soft-delete support
    // No version field for optimistic locking

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }
    public double getPrice() { return price; }
    public void setPrice(double price) { this.price = price; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    // No equals/hashCode/toString override
    // No validation
}
"""),

    # ─── Order model ──────────────────────────────────────────────────────────
    _f("src/main/java/com/acme/inventory/model/Order.java", """package com.acme.inventory.model;

import java.io.Serializable;
import java.util.Date;

/**
 * Order domain model.
 */
public class Order implements Serializable {
    private int id;
    private int productId;
    private String productName;  // Denormalized - data integrity risk
    private int quantity;
    private String customerEmail;  // No validation
    private double totalPrice;  // Should be BigDecimal
    private double discount;
    private String status;  // String instead of enum - typo-prone
    private Date createdAt;  // java.util.Date (deprecated, use java.time)
    // No customerId FK - customer info not tracked properly

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }
    public int getProductId() { return productId; }
    public void setProductId(int productId) { this.productId = productId; }
    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }
    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }
    public String getCustomerEmail() { return customerEmail; }
    public void setCustomerEmail(String customerEmail) { this.customerEmail = customerEmail; }
    public double getTotalPrice() { return totalPrice; }
    public void setTotalPrice(double totalPrice) { this.totalPrice = totalPrice; }
    public double getDiscount() { return discount; }
    public void setDiscount(double discount) { this.discount = discount; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }
}
"""),

    # ─── DatabaseUtil ─────────────────────────────────────────────────────────
    _f("src/main/java/com/acme/inventory/util/DatabaseUtil.java", """package com.acme.inventory.util;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * Database utility class.
 * Anti-pattern: hard-codes credentials in multiple places.
 * Should use connection pooling (e.g. HikariCP, C3P0).
 */
public class DatabaseUtil {

    // Credentials duplicated from InventoryDAO and InventoryController
    private static final String URL = "jdbc:mysql://localhost:3306/inventory_db";
    private static final String USER = "root";
    private static final String PASS = "admin123";

    // No connection pool - creates a new connection for each call
    public static Connection getConnection() throws SQLException {
        try {
            Class.forName("com.mysql.jdbc.Driver");  // Deprecated: use com.mysql.cj.jdbc.Driver
        } catch (ClassNotFoundException e) {
            throw new SQLException("MySQL driver not found", e);
        }
        return DriverManager.getConnection(URL, USER, PASS);
    }

    // No close utility - callers must remember to close
}
"""),

    # ─── EmailSender ──────────────────────────────────────────────────────────
    _f("src/main/java/com/acme/inventory/util/EmailSender.java", """package com.acme.inventory.util;

import java.util.Properties;
import javax.mail.*;
import javax.mail.internet.*;

/**
 * Simple email sender utility.
 * Problems:
 * - Static method - not injectable/mockable
 * - Credentials passed as parameters from callers that hard-code them
 * - No retry logic
 * - No async sending
 * - No email template engine
 */
public class EmailSender {

    public static void send(String host, String user, String pass,
                            String to, String subject, String htmlBody) throws Exception {
        Properties props = new Properties();
        props.put("mail.smtp.host", host);
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.port", "25");  // Unencrypted SMTP - security issue
        // No TLS/SSL configuration

        Session session = Session.getInstance(props, new Authenticator() {
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(user, pass);
            }
        });

        Message message = new MimeMessage(session);
        message.setFrom(new InternetAddress(user));
        message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(to));
        message.setSubject(subject);
        message.setContent(htmlBody, "text/html");
        Transport.send(message);
        // No logging of successful/failed sends
    }
}
"""),

    # ─── Spring config ────────────────────────────────────────────────────────
    _f("src/main/webapp/WEB-INF/spring/applicationContext.xml", """<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:context="http://www.springframework.org/schema/context"
       xsi:schemaLocation="
           http://www.springframework.org/schema/beans
           http://www.springframework.org/schema/beans/spring-beans-3.2.xsd
           http://www.springframework.org/schema/context
           http://www.springframework.org/schema/context/spring-context-3.2.xsd">

    <!-- Component scanning enabled but DB config is still hard-coded in Java -->
    <context:component-scan base-package="com.acme.inventory"/>

    <!-- DataSource: no connection pooling configured -->
    <!-- Should use HikariCP or similar -->
    <bean id="dataSource" class="org.springframework.jdbc.datasource.DriverManagerDataSource">
        <!-- SECURITY ISSUE: credentials in XML config, should be externalized -->
        <property name="driverClassName" value="com.mysql.jdbc.Driver"/>
        <property name="url" value="jdbc:mysql://localhost:3306/inventory_db"/>
        <property name="username" value="root"/>
        <property name="password" value="admin123"/>
    </bean>

    <!-- Hibernate SessionFactory - configured but not used (DAO uses raw JDBC instead) -->
    <bean id="sessionFactory" class="org.springframework.orm.hibernate4.LocalSessionFactoryBean">
        <property name="dataSource" ref="dataSource"/>
        <property name="packagesToScan" value="com.acme.inventory.model"/>
        <property name="hibernateProperties">
            <props>
                <prop key="hibernate.dialect">org.hibernate.dialect.MySQL5Dialect</prop>
                <!-- dev-mode setting left in production config -->
                <prop key="hibernate.show_sql">true</prop>
                <prop key="hibernate.hbm2ddl.auto">update</prop>
            </props>
        </property>
    </bean>

    <!-- Transaction manager configured but @Transactional not used in DAOs -->
    <bean id="transactionManager"
          class="org.springframework.orm.hibernate4.HibernateTransactionManager">
        <property name="sessionFactory" ref="sessionFactory"/>
    </bean>

    <!-- No caching configuration -->
    <!-- No async/messaging configuration -->
    <!-- No security configuration -->
</beans>
"""),

    # ─── log4j config ─────────────────────────────────────────────────────────
    _f("src/main/resources/log4j.properties", """# Log4j 1.x configuration (EOL - known security vulnerabilities)
# Should migrate to Log4j 2.x or SLF4J + Logback

log4j.rootLogger=DEBUG, stdout, file

# Console appender
log4j.appender.stdout=org.apache.log4j.ConsoleAppender
log4j.appender.stdout.layout=org.apache.log4j.PatternLayout
# Logs full stack traces to stdout in production - performance concern
log4j.appender.stdout.layout.ConversionPattern=%d{yyyy-MM-dd HH:mm:ss} %-5p %c{1}:%L - %m%n

# File appender - no rolling, no size limit - disk space concern
log4j.appender.file=org.apache.log4j.FileAppender
log4j.appender.file.File=/var/log/inventory/app.log
log4j.appender.file.layout=org.apache.log4j.PatternLayout
log4j.appender.file.layout.ConversionPattern=%d{yyyy-MM-dd HH:mm:ss} %-5p %c{1}:%L - %m%n

# DEBUG level in production - performance concern, may log sensitive data
log4j.logger.com.acme=DEBUG
log4j.logger.org.hibernate.SQL=DEBUG
log4j.logger.org.hibernate.type=TRACE
"""),

    # ─── JSP View ─────────────────────────────────────────────────────────────
    _f("src/main/webapp/WEB-INF/views/inventory/list.jsp", """<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%@ taglib prefix="fmt" uri="http://java.sun.com/jsp/jstl/fmt" %>
<!DOCTYPE html>
<!-- JSP technology (2003) - no component framework, no REST API, tightly coupled to server -->
<html>
<head>
    <title>ACME Inventory System</title>
    <!-- Inline styles - no CSS framework, no build pipeline -->
    <style>
        body { font-family: Arial; margin: 20px; background: #f0f0f0; }
        table { width: 100%; border-collapse: collapse; background: white; }
        th { background: #336699; color: white; padding: 8px; }
        td { border: 1px solid #ccc; padding: 6px; }
        .low-stock { background: #ffcccc; }
    </style>
    <!-- jQuery 1.8.3 - extremely outdated (2012), known XSS vulnerabilities -->
    <script src="/js/jquery-1.8.3.min.js"></script>
</head>
<body>
<h1>Inventory Management</h1>

<!-- No CSRF protection on search form -->
<form method="GET" action="/inventory/search">
    <input type="text" name="query" placeholder="Search products..."/>
    <input type="submit" value="Search"/>
</form>

<table>
    <tr>
        <th>ID</th><th>Name</th><th>Category</th><th>Quantity</th><th>Price</th><th>Actions</th>
    </tr>
    <c:forEach items="${products}" var="p">
        <!-- XSS vulnerability: no escaping of user-sourced data -->
        <tr class="${p.quantity < 10 ? 'low-stock' : ''}">
            <td>${p.id}</td>
            <td>${p.name}</td>
            <td>${p.category}</td>
            <td>${p.quantity}</td>
            <!-- Double used for price - formatting may show floating point errors -->
            <td>$<fmt:formatNumber value="${p.price}" pattern="#,##0.00"/></td>
            <td>
                <a href="/inventory/edit/${p.id}">Edit</a> |
                <!-- No confirmation dialog, no CSRF token -->
                <a href="/inventory/delete/${p.id}" onclick="return confirm('Delete?')">Delete</a>
            </td>
        </tr>
    </c:forEach>
</table>

<!-- Pagination not implemented - shows all records -->
<p>Showing all ${products.size()} records (no pagination)</p>

<!-- Debug information exposed in production -->
<c:if test="${not empty debugInfo}">
    <pre style="background:#fff;padding:10px;">${debugInfo}</pre>
</c:if>
</body>
</html>
"""),

    # ─── SQL schema ───────────────────────────────────────────────────────────
    _f("src/main/resources/schema.sql", """-- Legacy database schema - MySQL 5.x
-- Issues: no foreign key constraints, no indexes on commonly queried columns,
-- double/float for monetary values, varchar without proper lengths

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),           -- Should NOT NULL
    quantity INT DEFAULT 0,
    price DOUBLE,                -- ISSUE: use DECIMAL(10,2) for money
    category VARCHAR(100),
    created_at DATETIME,
    -- No updated_at, no deleted_at for soft delete
    -- No indexes on category or name (searched frequently)
    INDEX idx_category (category)   -- Only this one index
);

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT,              -- No FOREIGN KEY constraint
    product_name VARCHAR(255),   -- Denormalized, data drift risk
    quantity INT,
    customer_email VARCHAR(255), -- No validation constraint
    total_price DOUBLE,          -- Should be DECIMAL
    discount DOUBLE DEFAULT 0,
    status VARCHAR(50) DEFAULT 'PENDING',  -- Should be ENUM
    created_at DATETIME,
    -- No customer_id FK
    -- No index on customer_email or created_at
    -- No audit trail
    INDEX idx_created (created_at)
);

-- No stored procedures (all logic in Java)
-- No triggers
-- No views
-- No audit tables
-- Character set not explicitly specified
"""),

    # ─── README ───────────────────────────────────────────────────────────────
    _f("README.md", """# ACME Inventory Management System

Legacy Java web application for inventory and order management.

## Requirements

- Java 1.7
- Tomcat 6.x or 7.x
- MySQL 5.x
- Maven 2.x

## Setup

1. Create MySQL database: `inventory_db`
2. Run `schema.sql`
3. Update DB credentials in `applicationContext.xml`
4. Build: `mvn package`
5. Deploy WAR to Tomcat

## Known Issues

- TODO: Fix the search feature (ticket #1234 - open since 2015)
- TODO: Add authentication (currently no login required)
- TODO: Update dependencies (last done 2014)
- Performance degrades with >10,000 products
- Monthly report times out for large datasets
- Email sending sometimes fails silently

## Deployment

Deploy `target/inventory-system.war` to Tomcat webapps directory.

## Contacts

- Original developer: John Smith (left company 2016)
- Current maintainer: Jane Doe
"""),

    # ─── .properties config ───────────────────────────────────────────────────
    _f("src/main/resources/application.properties", """# Application configuration
# SECURITY ISSUE: All secrets in plaintext properties file
# Should use environment variables or a secrets manager

# Database
db.url=jdbc:mysql://localhost:3306/inventory_db
db.username=root
db.password=admin123
db.pool.size=5

# Email
smtp.host=mail.acme-internal.com
smtp.port=25
smtp.username=system@acme.com
smtp.password=smtp_password_2014
smtp.tls.enabled=false

# Application
app.name=ACME Inventory
app.version=1.0.0
app.debug=true
app.session.timeout=3600

# Hard-coded feature flags
feature.export.enabled=true
feature.reports.enabled=true
feature.bulk.import=false

# No environment differentiation (dev/staging/prod same config)
"""),

    # ─── Test (empty) ─────────────────────────────────────────────────────────
    _f("src/test/java/com/acme/inventory/InventoryControllerTest.java", """package com.acme.inventory;

/**
 * Tests for InventoryController.
 * STATUS: Empty - no tests implemented yet.
 * This class was created as a placeholder in 2014 and never completed.
 */
public class InventoryControllerTest {
    // TODO: Add unit tests
    // TODO: Add integration tests
    // TODO: Mock database connections
    // Current test coverage: 0%
}
"""),

    # ─── web.xml ──────────────────────────────────────────────────────────────
    _f("src/main/webapp/WEB-INF/web.xml", """<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="http://java.sun.com/xml/ns/javaee"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://java.sun.com/xml/ns/javaee
             http://java.sun.com/xml/ns/javaee/web-app_2_5.xsd"
         version="2.5">

    <display-name>ACME Inventory System</display-name>

    <context-param>
        <param-name>contextConfigLocation</param-name>
        <param-value>/WEB-INF/spring/applicationContext.xml</param-value>
    </context-param>

    <listener>
        <listener-class>org.springframework.web.context.ContextLoaderListener</listener-class>
    </listener>

    <servlet>
        <servlet-name>dispatcher</servlet-name>
        <servlet-class>org.springframework.web.servlet.DispatcherServlet</servlet-class>
        <init-param>
            <param-name>contextConfigLocation</param-name>
            <param-value>/WEB-INF/spring/mvc-config.xml</param-value>
        </init-param>
        <load-on-startup>1</load-on-startup>
    </servlet>

    <servlet-mapping>
        <servlet-name>dispatcher</servlet-name>
        <url-pattern>/</url-pattern>
    </servlet-mapping>

    <!-- Session timeout: 60 minutes - hard-coded -->
    <session-config>
        <session-timeout>60</session-timeout>
    </session-config>

    <!-- No security-constraint configured - all URLs accessible without auth -->
    <!-- No CSRF protection filter -->
    <!-- No Content Security Policy headers -->
    <!-- No HTTPS enforcement -->

    <error-page>
        <error-code>404</error-code>
        <location>/WEB-INF/views/error/404.jsp</location>
    </error-page>
    <error-page>
        <error-code>500</error-code>
        <!-- Shows full stack trace in production - information disclosure -->
        <location>/WEB-INF/views/error/500.jsp</location>
    </error-page>
</web-app>
"""),
]


def load_demo_files() -> List[Dict[str, Any]]:
    """Return the demo legacy project files."""
    return DEMO_FILES
