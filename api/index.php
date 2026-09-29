<?php
// ============================================================
//  api/index.php — Unified Contacts Manager RESTful API
//
//  GET    /api/index.php?ping=1            — status ping health check
//  POST   /api/index.php?action=register   — register new user
//  POST   /api/index.php                   — authenticate user (login)
//  GET    /api/index.php                   — list all contacts
//  GET    /api/index.php?q=term            — search contacts
//  POST   /api/index.php                   — create new contact
//  PUT    /api/index.php?id=1              — update contact by ID
//  DELETE /api/index.php?id=1              — delete contact by ID
// ============================================================
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/config/helpers.php';

setCORSHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// 1. Unauthenticated Health Check (Ping)
if ($method === 'GET' && (isset($_GET['ping']) || (isset($_GET['action']) && $_GET['action'] === 'ping'))) {
    respond(200, ['status' => 'OK', 'timestamp' => time()]);
}
	//REGISTER
if($method ==='POST' && (isset($_GET['action']) && $_GET['action'] ==='register')) {
	$body = getRequestBody();
	$login    = clean($body['login']);
        $password = clean($body['password']);
	$firstName = clean($body['firstName']);
	$lastName = clean($body['lastName']);	
	if(empty($firstName)|| empty($lastName) || empty($login) || empty($password)){
		respond(400, ["error" => "All fields are required."]);
	}
	//check if user already exists
	$checkstmt = $db->prepare('SELECT ID FROM Users Where Login = :login LIMIT 1');
	$checkstmt->execute([':login' => $login]);
	$userCheck = $checkstmt->fetch();
	//check user name
	if($userCheck){
	respond(409, ['error' => "Username taken!!!"]);
	}
	// if user name not taken then add new user
	else{
	$hashedPass = password_hash($password,PASSWORD_BCRYPT);
	$stmt = $db->prepare('INSERT INTO Users (FirstName, Lastname, Login, Password) VALUES (:first, :last, :login, :pass)');
	$stmt->execute([
	':first' => $firstName,
	':last' => $lastName,
	':login' => $login,
	':pass' => $hashedPass
	]);
	respond(201, [
	'message' => 'User registered successfully',
	'id' => (int) $db->lastInsertId(),
	'error' => ''
	]);
	}
}

	


// 2. Unauthenticated Login (POST with login & password in body)
if ($method === 'POST' && (!isset($_GET['action']) || $_GET['action'] === 'login')) {
    $body = getRequestBody();
    if (isset($body['login']) && isset($body['password'])) {
        $login    = clean($body['login']);
        $password = clean($body['password']);



        if (!$login || !$password) {
            respond(400, ['error' => 'Login and password are required']);
        }
	//LOGIN
        $stmt = $db->prepare('SELECT ID, FirstName, LastName, Password, IsAdmin, IsSuspended FROM Users WHERE Login = :login LIMIT 1');
        $stmt->execute([':login' => $login]);
        $user = $stmt->fetch();
        
        if ($user && password_verify($password,$user['Password'])) {
	    	if ((int) $user['IsSuspended'] === 1) {
                respond(403, ['error' => 'Account is suspended. Contact system administrator.']);
            }
            respond(200, [
                'id'        => (int) $user['ID'],
                'firstName' => $user['FirstName'],
                'lastName'  => $user['LastName'],
                'role'      => ((int)$user['IsAdmin'] === 1) ? 'admin' : 'user',
                'isAdmin'   => (int) $user['IsAdmin'],
                'token'     => (string) $user['ID'],
                'error'     => ''
            ]);
        }
 	else {
            respond(401, [
                'id'        => 0,
                'firstName' => '',
                'lastName'  => '',
                'error'     => 'No Records Found'
            ]);
        }
    }
}

// 3. All other routes require an authenticated user
$userId = requireAuth();

// Enforce active suspension check on EVERY authenticated request
$activeCheck = $db->prepare('SELECT IsSuspended FROM Users WHERE ID = :uid LIMIT 1');
$activeCheck->execute([':uid' => $userId]);
$activeUser = $activeCheck->fetch();

if (!$activeUser || (int)$activeUser['IsSuspended'] === 1) {
    respond(403, ['error' => 'Account is suspended or invalid. Access denied.']);
}

// =============================================================
// ADMIN ENDPOINTS
// =============================================================

$action = isset($_GET['action']) ? $_GET['action'] : '';

if (strpos($action, 'admin_') === 0) {

    // ---------------------------------------------------------
    // Verify that the logged-in user is an administrator
    // ---------------------------------------------------------

    $adminCheck = $db->prepare(
        'SELECT IsAdmin, IsSuspended
         FROM Users
         WHERE ID = :uid
         LIMIT 1'
    );

    $adminCheck->execute([
        ':uid' => $userId
    ]);

    $adminUser = $adminCheck->fetch();

    if (
        !$adminUser ||
        (int)$adminUser['IsAdmin'] !== 1 ||
        (int)$adminUser['IsSuspended'] === 1
    ) {
        respond(403, [
            'error' => 'Forbidden: Administrator access required'
        ]);
    }


    // =========================================================
    // GET ALL USERS / SEARCH USERS
    // =========================================================

    if ($method === 'GET' && $action === 'admin_users') {

        $search = trim($_GET['q'] ?? '');

        if ($search !== '') {

            $like = '%' . $search . '%';

            $stmt = $db->prepare(
                'SELECT
                    ID,
                    FirstName,
                    LastName,
                    Login,
                    IsAdmin,
                    IsSuspended
                 FROM Users
                 WHERE
                    FirstName LIKE :q1
                    OR LastName LIKE :q2
                    OR Login LIKE :q3
                 ORDER BY LastName, FirstName'
            );

            $stmt->execute([
                ':q1' => $like,
                ':q2' => $like,
                ':q3' => $like
            ]);

        } else {

            $stmt = $db->query(
                'SELECT
                    ID,
                    FirstName,
                    LastName,
                    Login,
                    IsAdmin,
                    IsSuspended
                 FROM Users
                 ORDER BY LastName, FirstName'
            );
        }

        respond(200, [
            'results' => $stmt->fetchAll(),
            'error' => ''
        ]);
    }


    // =========================================================
    // DISABLE / ENABLE USER
    // =========================================================

    if (
        $method === 'POST' &&
        $action === 'admin_toggle_suspend'
    ) {

        $body = getRequestBody();

        $targetId =
            (int)($body['userId'] ?? 0);

        $suspendState =
            (int)($body['isSuspended'] ?? 0);

        if (!$targetId) {
            respond(400, [
                'error' => 'Target user ID is required'
            ]);
        }

        $check = $db->prepare(
            'SELECT ID
             FROM Users
             WHERE ID = :id
             LIMIT 1'
        );

        $check->execute([
            ':id' => $targetId
        ]);

        if (!$check->fetch()) {
            respond(404, [
                'error' => 'User not found'
            ]);
        }

        $stmt = $db->prepare(
            'UPDATE Users
             SET IsSuspended = :state
             WHERE ID = :id'
        );

        $stmt->execute([
            ':state' => $suspendState,
            ':id' => $targetId
        ]);

        respond(200, [
            'message' =>
                $suspendState
                ? 'User disabled successfully'
                : 'User enabled successfully',
            'error' => ''
        ]);
    }


    // =========================================================
    // CHANGE USER PASSWORD
    // =========================================================

    if (
        $method === 'POST' &&
        $action === 'admin_reset_password'
    ) {

        $body = getRequestBody();

        $targetId =
            (int)($body['userId'] ?? 0);

        $newPassword =
            trim($body['newPassword'] ?? '');

        if (!$targetId || !$newPassword) {
            respond(400, [
                'error' =>
                    'User ID and new password are required'
            ]);
        }

        if (strlen($newPassword) < 8) {
            respond(400, [
                'error' =>
                    'Password must be at least 8 characters'
            ]);
        }

        $check = $db->prepare(
            'SELECT ID
             FROM Users
             WHERE ID = :id
             LIMIT 1'
        );

        $check->execute([
            ':id' => $targetId
        ]);

        if (!$check->fetch()) {
            respond(404, [
                'error' => 'User not found'
            ]);
        }

        // IMPORTANT:
        // Never store the new password as plaintext.
        $hashedPassword =
            password_hash(
                $newPassword,
                PASSWORD_BCRYPT
            );

        $stmt = $db->prepare(
            'UPDATE Users
             SET Password = :password
             WHERE ID = :id'
        );

        $stmt->execute([
            ':password' => $hashedPassword,
            ':id' => $targetId
        ]);

        respond(200, [
            'message' =>
                'Password updated successfully',
            'error' => ''
        ]);
    }


    // =========================================================
    // CREATE ADMIN ACCOUNT
    // =========================================================

    if (
        $method === 'POST' &&
        $action === 'admin_create_admin'
    ) {

        $body = getRequestBody();

        $first =
            clean($body['firstName'] ?? '');

        $last =
            clean($body['lastName'] ?? '');

        $login =
            clean($body['login'] ?? '');

        $password =
            trim($body['password'] ?? '');

        if (
            !$first ||
            !$last ||
            !$login ||
            !$password
        ) {
            respond(400, [
                'error' => 'All fields are required'
            ]);
        }

        if (strlen($password) < 8) {
            respond(400, [
                'error' =>
                    'Password must be at least 8 characters'
            ]);
        }

        // Check username
        $check = $db->prepare(
            'SELECT ID
             FROM Users
             WHERE Login = :login
             LIMIT 1'
        );

        $check->execute([
            ':login' => $login
        ]);

        if ($check->fetch()) {
            respond(409, [
                'error' => 'Username already exists'
            ]);
        }

        $hashedPassword =
            password_hash(
                $password,
                PASSWORD_BCRYPT
            );

        $stmt = $db->prepare(
            'INSERT INTO Users
            (
                FirstName,
                LastName,
                Login,
                Password,
                IsAdmin,
                IsSuspended
            )
            VALUES
            (
                :first,
                :last,
                :login,
                :password,
                1,
                0
            )'
        );

        $stmt->execute([
            ':first' => $first,
            ':last' => $last,
            ':login' => $login,
            ':password' => $hashedPassword
        ]);

        respond(201, [
            'message' => 'Admin account created successfully',
            'id' => (int)$db->lastInsertId(),
            'error' => ''
        ]);
    }


    // =========================================================
    // VIEW ANOTHER USER'S CONTACTS
    // =========================================================

    if (
        $method === 'GET' &&
        $action === 'admin_user_contacts'
    ) {

        $targetId =
            (int)($_GET['userId'] ?? 0);

        if (!$targetId) {
            respond(400, [
                'error' => 'User ID is required'
            ]);
        }

        $check = $db->prepare(
            'SELECT ID
             FROM Users
             WHERE ID = :id
             LIMIT 1'
        );

        $check->execute([
            ':id' => $targetId
        ]);

        if (!$check->fetch()) {
            respond(404, [
                'error' => 'User not found'
            ]);
        }

        // added IsFavorite to Admin View
        $stmt = $db->prepare(
            'SELECT
                ID,
                FirstName,
                LastName,
                Email,
                PhoneNumber,
                IsFavorite
             FROM Contacts
             WHERE UserID = :uid
             ORDER BY FirstName, LastName'
        );

        $stmt->execute([
            ':uid' => $targetId
        ]);

        respond(200, [
            'results' => $stmt->fetchAll(),
            'error' => ''
        ]);
    }
}



switch ($method) {


// ── GET: search or list contacts ──────────────────────────
    case 'GET':
        $search = isset($_GET['q']) ? trim($_GET['q']) : (isset($_GET['search']) ? trim($_GET['search']) : null);

        if ($search !== null && $search !== '') {
            $like = '%' . $search . '%';
            
            // to fix searching space issue
            $stmt = $db->prepare("SELECT ID, FirstName, LastName, Email, PhoneNumber, IsFavorite FROM Contacts WHERE UserID = :uid AND (FirstName LIKE :q1 OR LastName LIKE :q2 OR Email LIKE :q3 OR PhoneNumber LIKE :q4 OR CONCAT(FirstName, ' ', LastName) LIKE :q5) ORDER BY FirstName");
            
            $stmt->execute([
                ':uid' => $userId, 
                ':q1' => $like,
                ':q2' => $like,
                ':q3' => $like,
                ':q4' => $like,
                ':q5' => $like
            ]);
        } else {
            // default query for loading all contacts
            $stmt = $db->prepare('SELECT ID, FirstName, LastName, Email, PhoneNumber, IsFavorite FROM Contacts WHERE UserID = :uid ORDER BY FirstName');
            $stmt->execute([':uid' => $userId]);
        }

        $contacts = $stmt->fetchAll();

        if (empty($contacts)) {
            respond(200, ['results' => [], 'error' => 'No Records Found']);
        }

        respond(200, ['results' => $contacts, 'error' => '']);
        break;

    case 'POST':
        $body  = getRequestBody();
        $first = clean($body['firstName'] ?? '');
	$last  = clean($body['lastName'] ?? '');
	$email = clean($body['email'] ?? '');
	$phone = clean($body['phoneNumber'] ?? ''); 
	
        // isFavourite
        $isFav = isset($body['isFavorite']) ? (int)$body['isFavorite'] : 0;
		
	if(!$first || !$last) {
		respond(400, ['error'=> 'first and last name required']);
	}

        // added IsFavorite to the INSERT statement and values array
        $stmt = $db->prepare('INSERT INTO Contacts (FirstName, LastName, Email, PhoneNumber, UserID, IsFavorite) VALUES (:first, :last, :email, :phone, :uid, :isFav)');
        $stmt->execute([
	':first' => $first,
	':last' => $last,
	':email' => $email,
	':phone' => $phone,
	':uid' => $userId,
        ':isFav' => $isFav
	]);

        respond(201, [
            'message' => 'Contact created',
            'id'      => (int) $db->lastInsertId(),
            'error'   => ''
        ]);
        break;

// ── PUT: update contact ─────────────────────────────────────
    case 'PUT':
        $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
        if (!$id) {
            respond(400, ['error' => 'Contact ID is required — use ?id=']);
        }

        $check = $db->prepare('SELECT ID FROM Contacts WHERE ID = :id AND UserID = :uid LIMIT 1');
        $check->execute([':id' => $id, ':uid' => $userId]);
        if (!$check->fetch()) {
            respond(404, ['error' => 'Contact not found']);
        }

        $body  = getRequestBody();
        $first = clean($body['firstName'] ?? '');
        $last  = clean($body['lastName'] ?? '');
        $email = clean($body['email'] ?? '');
        $phone = clean($body['phoneNumber'] ?? '');
        
        // NEW: Grab the favorite status from the edit menu
        $isFav = isset($body['isFavorite']) ? (int)$body['isFavorite'] : 0;

        if (!$first || !$last) {
            respond(400, ['error' => 'First and Last name are required']);
        }

        // NEW: Added IsFavorite = :isFav to the UPDATE query
        $stmt = $db->prepare('UPDATE Contacts SET FirstName = :first, LastName = :last, Email = :email, PhoneNumber = :phone, IsFavorite = :isFav WHERE ID = :id AND UserID = :uid');
        $stmt->execute([
            ':first' => $first,
            ':last'  => $last,
            ':email' => $email,
            ':phone' => $phone,
            ':isFav' => $isFav,
            ':id'    => $id,
            ':uid'   => $userId
        ]);

        respond(200, ['message' => 'Contact updated', 'error' => '']);
        break;


// ── DELETE: delete contact ──────────────────────────────────
    case 'DELETE':
        $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

        if (!$id) {
            respond(400, ['error' => 'Contact ID is required — use ?id=']);
        }

        $stmt = $db->prepare('DELETE FROM Contacts WHERE ID = :id AND UserID = :uid');
        $stmt->execute([':id' => $id, ':uid' => $userId]);

        if ($stmt->rowCount() === 0) {
            respond(404, ['error' => 'Contact not found']);
        }

        respond(200, ['message' => 'Contact deleted', 'error' => '']);
        break;
}