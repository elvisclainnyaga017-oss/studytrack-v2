"use strict";

// STUDYTRACK V2 VERCEL ENTRY POINT

// Import Express directly so Vercel can identify the framework.
const express = require("express");

// Import the existing StudyTrack Express application.
const app = require("./server/server");

// Export the existing application for Vercel.
module.exports = app;