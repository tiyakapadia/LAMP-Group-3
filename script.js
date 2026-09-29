 
const apiURL = "/api/index.php";

//Call api for login
async function apiLogin(username, password)
{
    const response = await fetch(
        apiURL,
        {
            method: "POST",
            headers:
            {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(
            {
                login: username,
                password: password
            })
        });

    return await response.json();
}

//Login prep 
async function processLogin()
{
    console.log("processLogin started");
    let username = document.getElementById("username").value.trim();
    let password = document.getElementById("password").value.trim();

    let result = await apiLogin(username, password);
    console.log(result);

    if(result.error == "")
    {
        localStorage.setItem("userId", result.id);
        localStorage.setItem("token", result.token);
        localStorage.setItem("firstName", result.firstName);
        localStorage.setItem("lastName", result.lastName);
        localStorage.setItem("username", username);
        localStorage.setItem("role", result.role);

        window.location.href = (result.role == "admin") ? "admin.html" : "home.html";
    }
    else
    {
        document.getElementById("message").innerHTML = result.error;
        document.getElementById("message").style.color = "red";
    }
}

// Logout user
function doLogout()
{
    localStorage.clear();
    window.location.href = "index.html";
}

//Validate input
function checkInputs()
{
    let username = document.getElementById("username").value.trim();
    let password = document.getElementById("password").value.trim();
    let loginButton = document.getElementById("loginButton");

    if (username != "" && password != "")
    {
        loginButton.disabled = false;
    }
    else
    {
        loginButton.disabled = true;
    }
}

//Validate input method
function checkRegisterInputs()
{
    let firstName = document.getElementById("firstName").value.trim();
    let lastName = document.getElementById("lastName").value.trim();
    let username = document.getElementById("username").value.trim();
    let password = document.getElementById("password").value.trim();
    let registerButton = document.getElementById("registerButton");

    if(firstName != "" && lastName != "" && username != "" && password != "")
    {
        registerButton.disabled = false;
    }
    else
    {
        registerButton.disabled = true;
    }
}

//Register user
async function apiRegister(firstName, lastName, username, password)
{
    console.log("apiRegister called");
    const response = await fetch(
    apiURL + "?action=register",
        {
            method: "POST",
            headers:
            {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(
            {
                firstName: firstName,
                lastName: lastName,
                login: username,
                password: password
            })
        });

    const data = await response.json();
    return data;
}

//Format for registration and display return messages
async function processRegister()
{
    console.log("processRegister called");
    let firstName = document.getElementById("firstName").value.trim();
    let lastName = document.getElementById("lastName").value.trim();
    let username = document.getElementById("username").value.trim();
    let password = document.getElementById("password").value.trim();

    let result = await apiRegister(firstName, lastName, username, password);

    //No error, success.
    if(result.error == "")
    {
        document.getElementById("message").innerHTML = "Account created successfully!";
        document.getElementById("message").style.color = "green";

        setTimeout(function()
        {
            window.location.href = "index.html";  //Redirects to home page
        },1500);
    }
    else
    {
        document.getElementById("message").innerHTML = result.error;
        document.getElementById("message").style.color = "red";
    }
}

// Homepage welcome message
window.onload = function()
{

    // Admin page: kick out anyone who isn't an admin, then load users
    if (document.getElementById("usersBody"))
    {
        if (localStorage.getItem("role") != "admin")
        {
            window.location.href = "index.html";
            return;
        }
        searchUsers();
        return;
    }
    
    // If we're not on the home page, do nothing.
    if (!document.getElementById("welcomeMessage"))
    {
        return;
    }

    let firstName = localStorage.getItem("firstName");
    let lastName = localStorage.getItem("lastName");
    let userId = localStorage.getItem("userId");
    let username = localStorage.getItem("username");

    document.getElementById("username").innerHTML = username;
    document.getElementById("welcomeMessage").innerHTML = "Welcome back, " + firstName + "!";
    document.getElementById("userName").innerHTML = firstName + " " + lastName;
    document.getElementById("userId").innerHTML = userId;
};

//Add new contact (Now sends the VIP status to the database)
async function addContact()
{
    let fullName = document.getElementById("addName").value.trim();
    let phone = document.getElementById("addPhone").value.trim();
    let email = document.getElementById("addEmail").value.trim();
    let msg = document.getElementById("addMessage");

    // Grab the VIP Checkbox status
    let favCheckbox = document.getElementById("addFavorite");
    let isFav = (favCheckbox && favCheckbox.checked) ? 1 : 0;

    if (fullName == "")
    {
        msg.innerHTML = "Name is required.";
        msg.style.color = "red";
        return;
    }

    let nameParts = fullName.split(" ");
    let firstName = nameParts[0];
    let lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

    try
    {
        const response = await fetch(
            apiURL,
            {
                method: "POST",
                headers:
                {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + localStorage.getItem("token")
                },
                body: JSON.stringify(
                {
                    firstName: firstName,
                    lastName: lastName,
                    phoneNumber: phone,
                    email: email,
                    isFavorite: isFav // This tells the database to save the star!
                })
            });

        if (response.ok)
        {
            msg.innerHTML = "Contact added successfully!";
            msg.style.color = "green";

            document.getElementById("addName").value = "";
            document.getElementById("addPhone").value = "";
            document.getElementById("addEmail").value = "";
            if (favCheckbox) favCheckbox.checked = false;
            
            doSearch(); // Refresh list to show the new star
        }
        else
        {
            msg.innerHTML = "Failed to add contact.";
            msg.style.color = "red";
        }
    }
    catch (err)
    {
        msg.innerHTML = "Server connection error.";
        msg.style.color = "red";
    }
}

//Search contacts 
async function doSearch()
{
    let term = document.getElementById("searchInput").value.trim();
    let tbody = document.getElementById("contactsBody");
    let msg = document.getElementById("searchMessage");

    tbody.innerHTML = "";
    msg.innerHTML = "";

    try
    {
        const response = await fetch(
            apiURL + "?q=" + encodeURIComponent(term),
            {
                method: "GET",
                headers:
                {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + localStorage.getItem("token")
                }
            });

        const data = await response.json();
        let contacts = data.results || data;

        if (contacts && contacts.length > 0 && !contacts.error)
        {
            contacts.forEach(contact =>
            {
                let fname = contact.FirstName || contact.firstName || "";
                let lname = contact.LastName || contact.lastName || "";
                let phone = contact.PhoneNumber || contact.phoneNumber || contact.phone || "";
                let email = contact.Email || contact.email || "";
                let id = contact.ID || contact.id;

                let isFav = (contact.IsFavorite == 1 || contact.isFavorite == 1);
                let star = isFav ? "<span style='color: #BA9B37; font-size: 1.2em;'>&#9733; </span>" : "";

                let row = "<tr>" +
                    "<td>" + star + fname + " " + lname + "</td>" +
                    "<td>" + (phone || "N/A") + "</td>" +
                    "<td>" + (email || "N/A") + "</td>" +
                    "<td>" +
                        // edit
"<button class=\"nav-button\" onclick=\"openEditModal(" + id + ", '" + fname + " " + lname + "', '" + phone + "', '" + email + "', " + (isFav ? 1 : 0) + ")\">Edit</button> " +
                        "<button class=\"delete-button\" onclick=\"deleteContact(" + id + ")\">Delete</button>" +
                    "</td>" +
                "</tr>";

                tbody.innerHTML += row;
            });
        }
        else
        {
            tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; padding: 40px;'><h3 style='color: #888; margin-bottom: 10px;'>No contacts found</h3><p style='color: #aaa;'>Use the form below to start building your network.</p></td></tr>";
        }
    }
    catch (e)
    {
        msg.innerHTML = "Error fetching contacts.";
    }
}

function openEditModal(id, name, phone, email, isFav) {
    document.getElementById("editId").value = id;
    document.getElementById("editName").value = name;
    document.getElementById("editPhone").value = (phone === "N/A" ? "" : phone);
    document.getElementById("editEmail").value = (email === "N/A" ? "" : email);
    document.getElementById("editFavorite").checked = (isFav === 1);

    document.getElementById("editModal").style.display = "block";
}

function closeEditModal() {
    document.getElementById("editModal").style.display = "none";
}

async function saveEdit() {
    let id = document.getElementById("editId").value;
    let fullName = document.getElementById("editName").value.trim();
    let phone = document.getElementById("editPhone").value.trim();
    let email = document.getElementById("editEmail").value.trim();
    let isFav = document.getElementById("editFavorite").checked ? 1 : 0;

    if (fullName === "") {
        alert("Name is required.");
        return;
    }

    let nameParts = fullName.split(" ");
    let firstName = nameParts[0];
    let lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

    try {
        const response = await fetch(apiURL + "?id=" + id, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("token")
            },
            body: JSON.stringify({
                firstName: firstName,
                lastName: lastName,
                phoneNumber: phone,
                email: email,
                isFavorite: isFav
            })
        });

        if (response.ok) {
            closeEditModal();
            doSearch(); 
        } else {
            alert("Failed to update contact.");
        }
    } catch (e) {
        alert("Server connection error.");
    }
}

//Delete contact
async function deleteContact(id)
{
    if (!confirm("Are you sure you want to delete this contact?"))
    {
        return;
    }

    try
    {
        const response = await fetch(
            apiURL + "?id=" + id,
            {
                method: "DELETE",
                headers:
                {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + localStorage.getItem("token")
                }
            });

        if (response.ok)
        {
            // Refresh the table immediately after deleting
            doSearch();
        }
        else
        {
            alert("Failed to delete contact.");
        }
    }
    catch (e)
    {
        alert("Server connection error.");
    }
}





// ===================== ADMIN FUNCTIONS =====================

function adminHeaders()
{
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + localStorage.getItem("token")
    };
}


// Prevent non-admins from using admin page
function checkAdmin()
{
    if (localStorage.getItem("role") !== "admin")
    {
        window.location.href = "index.html";
        return false;
    }

    return true;
}


// Prevent user data from being interpreted as HTML
function esc(text)
{
    let div = document.createElement("div");

    div.textContent =
        text == null ? "" : text;

    return div.innerHTML;
}


// ============================================================
// LOAD ALL USERS
// ============================================================

async function loadAllUsers()
{
    if (!checkAdmin())
    {
        return;
    }

    await getUsers("");
}


// ============================================================
// SEARCH USERS
// ============================================================

async function searchUsers()
{
    if (!checkAdmin())
    {
        return;
    }

    let searchBox =
        document.getElementById("userSearchInput");

    let term =
        searchBox ? searchBox.value.trim() : "";

    await getUsers(term);
}


async function getUsers(term)
{
    let tbody =
        document.getElementById("usersBody");

    let message =
        document.getElementById("userSearchMessage");

    tbody.innerHTML = "";
    message.innerHTML = "";

    try
    {
        const response = await fetch(
            apiURL +
            "?action=admin_users&q=" +
            encodeURIComponent(term),
            {
                method: "GET",
                headers: adminHeaders()
            }
        );

        const data = await response.json();

        if (!response.ok)
        {
            message.innerHTML =
                data.error || "Unable to load users.";

            return;
        }

        let users =
            data.results || [];

        if (users.length === 0)
        {
            tbody.innerHTML =
                "<tr>" +
                "<td colspan='5'>" +
                "No users found." +
                "</td>" +
                "</tr>";

            return;
        }

        users.forEach(function(user)
        {
            let isAdmin =
                parseInt(user.IsAdmin) === 1;

            let isSuspended =
                parseInt(user.IsSuspended) === 1;

            let role =
                isAdmin
                ? "Administrator"
                : "User";

            let status =
                isSuspended
                ? "Disabled"
                : "Active";

            let buttonText =
                isSuspended
                ? "Enable"
                : "Disable";

            tbody.innerHTML +=
                "<tr>" +

                "<td>" +
                esc(user.FirstName) +
                " " +
                esc(user.LastName) +
                "</td>" +

                "<td>" +
                esc(user.Login) +
                "</td>" +

                "<td>" +
                role +
                "</td>" +

                "<td>" +
                status +
                "</td>" +

                "<td>" +

                "<button class='nav-button' " +
                "onclick='toggleUser(" +
                user.ID +
                "," +
                (isSuspended ? 0 : 1) +
                ")'>" +
                buttonText +
                "</button> " +

                "<button class='nav-button' " +
                "onclick='changeUserPassword(" +
                user.ID +
                ")'>" +
                "Change Password" +
                "</button> " +

                "<button class='nav-button' " +
                "onclick='viewUserContacts(" +
                user.ID +
                ")'>" +
                "View Contacts" +
                "</button>" +

                "</td>" +

                "</tr>";
        });
    }
    catch (error)
    {
        message.innerHTML =
            "Error fetching users.";
    }
}


// ============================================================
// CREATE ADMIN
// ============================================================

async function createAdminAccount()
{
    if (!checkAdmin())
    {
        return;
    }

    let message =
        document.getElementById("adminMessage");

    let firstName =
        document.getElementById("adminFirst")
        .value.trim();

    let lastName =
        document.getElementById("adminLast")
        .value.trim();

    let username =
        document.getElementById("adminUser")
        .value.trim();

    let password =
        document.getElementById("adminPass")
        .value;

    if (
        !firstName ||
        !lastName ||
        !username ||
        !password
    ) {
        message.innerHTML =
            "All fields are required.";

        message.style.color = "red";

        return;
    }

    try
    {
        const response = await fetch(
            apiURL +
            "?action=admin_create_admin",
            {
                method: "POST",
                headers: adminHeaders(),

                body: JSON.stringify({
                    firstName: firstName,
                    lastName: lastName,
                    login: username,
                    password: password
                })
            }
        );

        const data =
            await response.json();

        if (!response.ok)
        {
            message.innerHTML =
                data.error ||
                "Unable to create admin.";

            message.style.color = "red";

            return;
        }

        message.innerHTML =
            "Admin account created successfully!";

        message.style.color = "green";

        document.getElementById("adminFirst").value = "";
        document.getElementById("adminLast").value = "";
        document.getElementById("adminUser").value = "";
        document.getElementById("adminPass").value = "";

        loadAllUsers();
    }
    catch (error)
    {
        message.innerHTML =
            "Server connection error.";

        message.style.color = "red";
    }
}


// ============================================================
// DISABLE / ENABLE USER
// ============================================================

async function toggleUser(userId, newState)
{
    if (!checkAdmin())
    {
        return;
    }

    let action =
        newState === 1
        ? "disable"
        : "enable";

    if (!confirm(
        "Are you sure you want to " +
        action +
        " this user?"
    ))
    {
        return;
    }

    try
    {
        const response = await fetch(
            apiURL +
            "?action=admin_toggle_suspend",
            {
                method: "POST",
                headers: adminHeaders(),

                body: JSON.stringify({
                    userId: userId,
                    isSuspended: newState
                })
            }
        );

        const data =
            await response.json();

        if (!response.ok)
        {
            alert(
                data.error ||
                "Operation failed."
            );

            return;
        }

        loadAllUsers();
    }
    catch (error)
    {
        alert(
            "Server connection error."
        );
    }
}


// ============================================================
// CHANGE PASSWORD (MODAL)
// ============================================================

// 1. Opens the custom modal instead of the browser prompt
function changeUserPassword(userId)
{
    if (!checkAdmin()) return;
    
    document.getElementById("resetUserId").value = userId;
    document.getElementById("resetPasswordInput").value = ""; 
    document.getElementById("passwordModalMessage").innerHTML = ""; 
    
    document.getElementById("passwordModal").style.display = "block";
}

// 2. Closes the modal if the user clicks Cancel
function closePasswordModal()
{
    document.getElementById("passwordModal").style.display = "none";
}

// 3. Sends the new password to the API
async function saveNewPassword()
{
    if (!checkAdmin()) return;

    let userId = document.getElementById("resetUserId").value;
    let password = document.getElementById("resetPasswordInput").value.trim();
    let messageElement = document.getElementById("passwordModalMessage");

    if (password.length < 8)
    {
        messageElement.innerHTML = "Password must be at least 8 characters.";
        messageElement.style.color = "red";
        return;
    }

    try
    {
        const response = await fetch(
            apiURL + "?action=admin_reset_password",
            {
                method: "POST",
                headers: adminHeaders(),
                body: JSON.stringify({
                    userId: userId,
                    newPassword: password
                })
            }
        );

        const data = await response.json();

        if (!response.ok)
        {
            messageElement.innerHTML = data.error || "Password update failed.";
            messageElement.style.color = "red";
            return;
        }

        // Close modal and show success alert
        closePasswordModal();
        alert("Password updated successfully.");
    }
    catch (error)
    {
        messageElement.innerHTML = "Server connection error.";
        messageElement.style.color = "red";
    }
}


// ============================================================
// VIEW USER CONTACTS
// ============================================================

async function viewUserContacts(userId)
{
    if (!checkAdmin())
    {
        return;
    }

    try
    {
        const response = await fetch(
            apiURL +
            "?action=admin_user_contacts&userId=" +
            encodeURIComponent(userId),
            {
                method: "GET",
                headers: adminHeaders()
            }
        );

        const data =
            await response.json();

        if (!response.ok)
        {
            alert(
                data.error ||
                "Unable to load contacts."
            );

            return;
        }

        let contacts =
            data.results || [];

        if (contacts.length === 0)
        {
            alert(
                "This user has no contacts."
            );

            return;
        }

        let output =
            "User Contacts\n\n";

        contacts.forEach(function(contact)
        {
            output +=
                (contact.FirstName || "") +
                " " +
                (contact.LastName || "") +
                "\n" +

                "Email: " +
                (contact.Email || "N/A") +
                "\n" +

                "Phone: " +
                (contact.PhoneNumber || "N/A") +
                "\n\n";
        });

        alert(output);
    }
    catch (error)
    {
        alert(
            "Server connection error."
        );
    }
}
