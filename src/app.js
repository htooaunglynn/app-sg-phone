const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Import configuration utility
const config = require('./utils/config');

// ============= DATA MANAGEMENT =============

// Initialize localStorage with demo data
function initializeDemoData() {
    if (!localStorage.getItem("companies")) {
        const demoData = [
            {
                id: "001",
                phone: "+1 (555) 123-4567",
                companyName: "Tech Innovations Inc",
                physicalAddress: "123 Silicon Valley, CA 94025",
                email: "contact@techinnovations.com",
                website: "www.techinnovations.com",
            },
            {
                id: "002",
                phone: "+1 (555) 234-5678",
                companyName: "Global Solutions Ltd",
                physicalAddress: "456 Business Park, NY 10001",
                email: "info@globalsolutions.com",
                website: "www.globalsolutions.com",
            },
            {
                id: "003",
                phone: "+1 (555) 345-6789",
                companyName: "Digital Marketing Co",
                physicalAddress: "789 Creative Street, TX 75001",
                email: "hello@digitalmarketing.com",
                website: "www.digitalmarketing.com",
            },
        ]
        localStorage.setItem("companies", JSON.stringify(demoData))
    }
}

// Get all companies
function getCompanies() {
    const data = localStorage.getItem("companies")
    return data ? JSON.parse(data) : []
}

// Save companies
function saveCompanies(data) {
    localStorage.setItem("companies", JSON.stringify(data))
}

// Add new company
function addCompany(company) {
    const companies = getCompanies()
    company.id = Date.now().toString()
    companies.push(company)
    saveCompanies(companies)
}

// Delete company
function deleteCompany(id) {
    const companies = getCompanies()
    const filtered = companies.filter((c) => c.id !== id)
    saveCompanies(filtered)
    renderTable()
}

// ============= TABLE OPERATIONS =============

function renderTable() {
    const companies = getCompanies()
    const tableBody = document.getElementById("tableBody")
    const emptyState = document.getElementById("emptyState")

    if (!tableBody) return

    if (companies.length === 0) {
        tableBody.innerHTML = ""
        if (emptyState) emptyState.classList.remove("hidden")
        return
    }

    if (emptyState) emptyState.classList.add("hidden")

    tableBody.innerHTML = companies
        .map(
            (company) => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 text-sm font-medium">${escapeHtml(company.id)}</td>
            <td class="px-6 py-4 text-sm">${escapeHtml(company.phone)}</td>
            <td class="px-6 py-4 text-sm">${escapeHtml(company.companyName)}</td>
            <td class="px-6 py-4 text-sm text-gray-600">${escapeHtml(company.physicalAddress)}</td>
            <td class="px-6 py-4 text-sm text-blue-600 break-all"><a href="mailto:${company.email}">${escapeHtml(company.email)}</a></td>
            <td class="px-6 py-4 text-sm text-blue-600"><a href="http://${company.website}" target="_blank">${escapeHtml(company.website)}</a></td>
            <td class="px-6 py-4 text-sm">
                <button onclick="deleteCompany('${company.id}')" class="text-red-600 hover:text-red-700 font-medium">Delete</button>
            </td>
        </tr>
    `,
        )
        .join("")
}

function filterTable() {
    const searchInput = document.getElementById("searchInput")
    if (!searchInput) return

    const searchTerm = searchInput.value.toLowerCase()
    const companies = getCompanies()
    const tableBody = document.getElementById("tableBody")
    const emptyState = document.getElementById("emptyState")

    const filtered = companies.filter(
        (company) =>
            company.companyName.toLowerCase().includes(searchTerm) ||
            company.email.toLowerCase().includes(searchTerm) ||
            company.phone.includes(searchTerm) ||
            company.website.toLowerCase().includes(searchTerm),
    )

    if (filtered.length === 0) {
        tableBody.innerHTML = ""
        emptyState.classList.remove("hidden")
        return
    }

    emptyState.classList.add("hidden")

    tableBody.innerHTML = filtered
        .map(
            (company) => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 text-sm font-medium">${escapeHtml(company.id)}</td>
            <td class="px-6 py-4 text-sm">${escapeHtml(company.phone)}</td>
            <td class="px-6 py-4 text-sm">${escapeHtml(company.companyName)}</td>
            <td class="px-6 py-4 text-sm text-gray-600">${escapeHtml(company.physicalAddress)}</td>
            <td class="px-6 py-4 text-sm text-blue-600 break-all"><a href="mailto:${company.email}">${escapeHtml(company.email)}</a></td>
            <td class="px-6 py-4 text-sm text-blue-600"><a href="http://${company.website}" target="_blank">${escapeHtml(company.website)}</a></td>
            <td class="px-6 py-4 text-sm">
                <button onclick="deleteCompany('${company.id}')" class="text-red-600 hover:text-red-700 font-medium">Delete</button>
            </td>
        </tr>
    `,
        )
        .join("")
}

// ============= EXCEL OPERATIONS =============

let selectedFile = null
const XLSX = require("xlsx") // Declare the XLSX variable

function openExcelModal() {
    document.getElementById("excelModal").classList.remove("hidden")
}

function closeExcelModal() {
    document.getElementById("excelModal").classList.add("hidden")
    document.getElementById("fileName").textContent = ""
    document.getElementById("excelFile").value = ""
    selectedFile = null
}

function handleFileUpload(event) {
    selectedFile = event.target.files[0]
    if (selectedFile) {
        document.getElementById("fileName").textContent = `Selected: ${selectedFile.name}`
    }
}

function uploadExcel() {
    if (!selectedFile) {
        alert("Please select a file")
        return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result)
            const workbook = XLSX.read(data, { type: "array" })
            const worksheet = workbook.Sheets[workbook.SheetNames[0]]
            const jsonData = XLSX.utils.sheet_to_json(worksheet)

            // Validate and map columns
            const companies = jsonData.map((row, index) => ({
                id: row["ID"] || row["id"] || (index + 1).toString(),
                phone: row["Phone"] || row["phone"] || "",
                companyName: row["Company Name"] || row["company name"] || row["Company"] || "",
                physicalAddress: row["Physical Address"] || row["physical address"] || row["Address"] || "",
                email: row["Email"] || row["email"] || "",
                website: row["Website"] || row["website"] || "",
            }))

            if (companies.length === 0) {
                alert("No data found in Excel file")
                return
            }

            saveCompanies(companies)
            trackUploadedFile(selectedFile.name)
            renderTable()
            renderFilesList()
            closeExcelModal()
            alert(`Successfully imported ${companies.length} companies`)
        } catch (error) {
            alert("Error reading Excel file: " + error.message)
        }
    }
    reader.readAsArrayBuffer(selectedFile)
}

function exportToExcel() {
    const companies = getCompanies()
    if (companies.length === 0) {
        alert("No data to export")
        return
    }

    const worksheet = XLSX.utils.json_to_sheet(companies)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Companies")
    XLSX.writeFile(workbook, "companies_export.xlsx")
}

// ============= AUTHENTICATION =============

function initializeAuth() {
    // Create demo user if not exists
    if (!localStorage.getItem("users")) {
        localStorage.setItem(
            "users",
            JSON.stringify([
                {
                    email: "demo@example.com",
                    password: "demo123",
                    name: "Demo User",
                },
            ]),
        )
    }

    updateUserDisplay()
    checkAuthentication()
}

function handleLogin(event) {
    event.preventDefault()

    const email = document.getElementById("loginEmail").value
    const password = document.getElementById("loginPassword").value
    const errorDiv = document.getElementById("loginError")

    const users = JSON.parse(localStorage.getItem("users") || "[]")
    const user = users.find((u) => u.email === email && u.password === password)

    if (user) {
        localStorage.setItem("currentUser", JSON.stringify(user))
        navigateTo("index.html")
    } else {
        errorDiv.textContent = "Invalid email or password"
        errorDiv.classList.remove("hidden")
    }
}

function handleRegister(event) {
    event.preventDefault()

    const name = document.getElementById("registerName").value
    const email = document.getElementById("registerEmail").value
    const password = document.getElementById("registerPassword").value
    const confirmPassword = document.getElementById("registerConfirmPassword").value
    const errorDiv = document.getElementById("registerError")

    if (password !== confirmPassword) {
        errorDiv.textContent = "Passwords do not match"
        errorDiv.classList.remove("hidden")
        return
    }

    const users = JSON.parse(localStorage.getItem("users") || "[]")

    if (users.find((u) => u.email === email)) {
        errorDiv.textContent = "Email already registered"
        errorDiv.classList.remove("hidden")
        return
    }

    users.push({ email, password, name })
    localStorage.setItem("users", JSON.stringify(users))
    localStorage.setItem("currentUser", JSON.stringify({ email, name }))

    navigateTo("index.html")
}

function logout() {
    localStorage.removeItem("currentUser")
    navigateTo("login.html")
}

function updateUserDisplay() {
    const userDisplay = document.getElementById("userDisplay")
    if (!userDisplay) return

    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null")
    if (currentUser) {
        userDisplay.textContent = currentUser.name || currentUser.email
    }
}

function checkAuthentication() {
    const currentUser = localStorage.getItem("currentUser")
    const currentPage = window.location.pathname.split("/").pop() || "index.html"

    if (!currentUser && currentPage !== "login.html" && currentPage !== "register.html") {
        navigateTo("login.html")
    }
}

// ============= FILE MANAGEMENT =============

function handleFileSelect(event) {
    const file = event.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append("file", file)

    // Simulate file storage
    addFile({
        name: file.name,
        size: (file.size / 1024).toFixed(2),
        uploadDate: new Date().toLocaleDateString(),
        type: file.type,
    })

    renderFilesList()
    document.getElementById("fileInput").value = ""
}

function addFile(file) {
    const files = JSON.parse(localStorage.getItem("uploadedFiles") || "[]")
    file.id = Date.now().toString()
    files.push(file)
    localStorage.setItem("uploadedFiles", JSON.stringify(files))
}

function getFiles() {
    return JSON.parse(localStorage.getItem("uploadedFiles") || "[]")
}

function deleteFile(id) {
    const files = getFiles()
    const filtered = files.filter((f) => f.id !== id)
    localStorage.setItem("uploadedFiles", JSON.stringify(filtered))
    renderFilesList()
}

function renderFilesList() {
    const filesList = document.getElementById("filesList")
    if (!filesList) return

    const files = getFiles()
    const fileCount = document.getElementById("fileCount")

    if (fileCount) {
        fileCount.textContent = `${files.length} file${files.length !== 1 ? "s" : ""}`
    }

    if (files.length === 0) {
        filesList.innerHTML = '<div class="px-6 py-8 text-center text-gray-600">No files uploaded yet</div>'
        return
    }

    filesList.innerHTML = files
        .map(
            (file) => `
        <div class="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
            <div class="flex items-center gap-3 flex-1">
                <svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clip-rule="evenodd"></path>
                </svg>
                <div>
                    <p class="font-medium text-gray-900">${escapeHtml(file.name)}</p>
                    <p class="text-sm text-gray-600">${file.type} • ${file.uploadDate}</p>
                </div>
            </div>
            <button onclick="deleteFile('${file.id}')" class="text-red-600 hover:text-red-700 font-medium text-sm px-3 py-2 hover:bg-red-50 rounded transition">Delete</button>
        </div>
    `,
        )
        .join("")
}

function trackUploadedFile(filename) {
    const files = getFiles()
    const newFile = {
        id: Date.now().toString(),
        name: filename,
        uploadDate: new Date().toLocaleDateString(),
        type: "Excel (.xlsx)",
    }
    files.push(newFile)
    localStorage.setItem("uploadedFiles", JSON.stringify(files))
}

// ============= UTILITIES =============

function navigateTo(page) {
    window.location.href = page
}

function escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
}

// ============= INITIALIZATION =============

document.addEventListener("DOMContentLoaded", () => {
    initializeAuth()
    initializeDemoData()
    renderTable()
    renderFilesList()
    updateUserDisplay()
})

// Drag and drop for file uploads
const fileInput = document.getElementById("fileInput")
if (fileInput) {
    document.addEventListener("dragover", (e) => {
        e.preventDefault()
        e.currentTarget.classList.add("drag-over")
    })

    document.addEventListener("dragleave", () => {
        document.querySelector('[id="fileInput"]')?.parentElement?.classList.remove("drag-over")
    })

    document.addEventListener("drop", (e) => {
        e.preventDefault()
        if (e.dataTransfer.files[0]) {
            fileInput.files = e.dataTransfer.files
            handleFileSelect({ target: { files: e.dataTransfer.files } })
        }
    })
}
