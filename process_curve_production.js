'use strict';
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const env = require("./env");
const {databases, connectToDatabase} = require("./Conection")
const sql = require('mssql');
const AWS = require('aws-sdk');
const awsConfig = require('./aws-config.json');
const env_messages = require('./env_messages');
AWS.config.update({
    accessKeyId: awsConfig.ACCESS_KEY_ID,
    secretAccessKey: awsConfig.SECRET_ACCESS_KEY,
    region: awsConfig.REGION
});

/**
 * Serverless function to process a CSV file named 'before2023.csv' and transform its contents into an array.
 *
 * @param {object} event - The event object triggering the function.
 * @returns {object} - The response object containing the transformed data and event input.
 */
async function process_curve_production_before_2023() {
    const errorMessages = [];
    try {
        const filePath = path.join(__dirname, 'before2023.csv');
        const dataArray = await readCsvFile(filePath);

        const pool = await connectToDatabase(databases.db_Aws)

        for (let i = 0; i < dataArray.length; i++) {
            try {
                const data = dataArray[i];
                console.log(`Processing entry ${i + 1} out of ${dataArray.length}`);

                let existingId = null;
                const verifyResult = await executeVerifyQuery(pool, data);

                if (!verifyResult) {
                    const insertedId = await executeInsertQuery(pool, data);
                    existingId = insertedId;
                } else {
                    existingId = verifyResult.id;
                }

                await insertDateRecordIfNotExists(pool, existingId, data);
            } catch (error) {
                if (error.message.includes("Date record already exists")) {
                    errorMessages.push(`Entry ${i + 1}: ${error.message}`);
                } else {
                    errorMessages.push(`Error processing entry ${i + 1}: ${error.message}`);
                }
            }
        }

        await pool.close();
        await sendReturnEmail(errorMessages, false);

    } catch (error) {
        console.log(error);
        errorMessages.push(`General processing error: ${error.message}`);
        // Enviar correo con los mensajes de error (si existen)
        await sendReturnEmail(errorMessages, false);
    }
};

/**
 * Reads a CSV file and transforms its contents into an array of objects.
 *
 * @param {string} filePath - The path to the CSV file.
 * @returns {Promise<Array>} - A promise that resolves with the array of objects from the CSV.
 */
async function readCsvFile(filePath) {
    return new Promise((resolve, reject) => {
        const dataArray = [];

        fs.createReadStream(filePath)
            .pipe(csvParser())
            .on('data', (data) => {
                const processedData = {};
                let rowIsValid = true;

                for (const header of env.HEADERS) {
                    const key = header.name;
                    const required = header.required;
                    const processType = header.process;
                    const params = header.params || {};

                    if (data[key]) {
                        if (processType === 'sanitize') {
                            processedData[key] = required
                                ? normalizeAndSanitize(data[key], params.replaceSpaces, params.replaceDots)
                                : data[key];
                        } else if (processType === 'transformDateFormat') {
                            processedData[key] = transformDateFormat(data[key]);
                        } else if (processType === 'decimal') {
                            processedData[key] = transformAndValidateDecimal(data[key]);
                        } else if (processType === 'week') {
                            const years = data.Temporada.split('-');
                            const firstYear = parseInt(years[0]);
                            const secondYear = parseInt(years[1]);

                            const targetYear = data[key] < 30 ? secondYear : firstYear;

                            processedData[key] = getFirstMondayOfISOWeek(targetYear, data[key]);
                        } else if (processType === 'none') {
                            processedData[key] = data[key];
                        }
                    } else if (required) {
                        rowIsValid = false;
                        break;
                    }
                }

                if (rowIsValid) {
                    dataArray.push(processedData);
                }
            })
            .on('end', () => {
                resolve(dataArray);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

/**
 * Normalizes and sanitizes a text by applying a series of transformations.
 * @param {string} text - The input text to be normalized and sanitized.
 * @param {boolean} replaceSpaces - Whether to replace spaces with underscores.
 * @param {boolean} replaceDots - Whether to remove periods.
 * @returns {string} - The normalized and sanitized text.
 */
function normalizeAndSanitize(text, replaceSpaces = false, replaceDots = true) {
    let result = text.toString().normalize("NFD");

    if (replaceDots) {
        result = result.replace(/[.,]/g, "");
    }

    result = result.toUpperCase();

    if (replaceSpaces) {
        result = result.replace(/\s+/g, "_");
    }

    result = result.replace(/[\u0300-\u036f]/g, "")
        .replace(/[\n\r]/g, "");

    return result;
}

/**
 * Transform data 'dd/mm/yyyy' to 'yyyy-mm-dd'.
 * @param {string} inputDate - date 'dd/mm/yyyy'.
 * @returns {string} return 'yyyy-mm-dd'
 * @throws {Error} If the input date format is invalid.
 */
function transformDateFormat(inputDate) {
    // Verificar si la fecha ya está en el formato deseado.
    if (/^\d{4}-\d{2}-\d{2}$/.test(inputDate)) {
        return inputDate;
    }

    // Dividir la fecha de entrada en partes usando el separador '/'.
    const parts = inputDate.split('/');

    // Verificar si la fecha tiene tres partes (día, mes y año).
    if (parts.length !== 3) {
        throw new Error('Formato de fecha inválido. Debe ser dd/mm/yyyy.');
    }

    const day = parts[0];
    const month = parts[1];
    const year = parts[2];

    // Devolver la fecha transformada en formato 'yyyy-mm-dd'.
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Transforms and validates a value to ensure it's a valid decimal number.
 * If the value contains a comma as a decimal separator, it replaces it with a dot.
 * Then attempts to convert the value into a decimal number and validates if it's a valid number.
 * @param {string} value - The value to transform and validate.
 * @returns {number|null} - The value as a decimal number if valid, or null if not valid.
 */
function transformAndValidateDecimal(value) {
    // Replace comma with dot as the decimal separator
    const sanitizedValue = value.replace(',', '.');

    // Try to convert the value into a decimal number
    const parsedValue = parseFloat(sanitizedValue);

    // Validate if the converted value is a valid number
    if (!isNaN(parsedValue) && isFinite(parsedValue)) {
        return parsedValue; // Return the valid numeric value
    } else {
        return null; // Return null if the value is not valid
    }
}

/**
 * Get the date of the first Monday of an ISO week in 'yyyy-mm-dd' format.
 * @param {number} year - The year for which the date is to be obtained.
 * @param {number} weekNumber - The ISO week number.
 * @returns {string} The date of the first Monday in 'yyyy-mm-dd' format.
 */
function getFirstMondayOfISOWeek(year, weekNumber) {
    // Create a date for January 4th of the specified year.
    const januaryFourth = new Date(year, 0, 4);

    // Calculate the number of days to add to reach the first day of the ISO week.
    const daysToAdd = (weekNumber - 1) * 7;

    // Move the date to the first Monday of the week.
    januaryFourth.setDate(januaryFourth.getDate() - januaryFourth.getDay() + 1);

    // Calculate the timestamp of the first Monday.
    const firstMondayTimestamp = januaryFourth.getTime() + daysToAdd * 24 * 60 * 60 * 1000;

    // Create a new date using the calculated timestamp.
    const firstMonday = new Date(firstMondayTimestamp);

    // Get the year, month, and day components as strings with leading zeros if necessary.
    const yearStr = firstMonday.getFullYear();
    const monthStr = (firstMonday.getMonth() + 1).toString().padStart(2, '0');
    const dayStr = firstMonday.getDate().toString().padStart(2, '0');

    // Return the date in 'yyyy-mm-dd' format.
    return `${yearStr}-${monthStr}-${dayStr}`;
}

/**
 * Executes a verification query to check if a matching row exists in the database.
 *
 * @param {Object} pool - The database connection pool.
 * @param {Object} data - The data object to use for verification.
 * @returns {Object|null} - The verification result object if a match is found, or null if not found.
 * @throws {Error} - If there's an error executing the verification query.
 */
async function executeVerifyQuery(pool, data) {
    try {
        const result = await pool.request()
            .input('Codigo_Huerto', sql.TYPES.Int, data.Codigo_Huerto)
            .input('PR_Productor', sql.TYPES.VarChar, data.PR_Productor)
            .input('Fruta', sql.TYPES.VarChar, data.Fruta)
            .input('Variedad', sql.TYPES.VarChar, data.Variedad)
            .input('fecha_insercion', sql.TYPES.Date, new Date(data.Fecha_Update))
            .query(env.SCRIPTS.VERIFY_EXIST_ROW_HUMAN_PROJECTION);

        return result.recordset[0];
    } catch (error) {
        console.error("Error executing verification query:", error);
        throw error;
    }
}

/**
 * Executes an insert query to add a new row to the database.
 *
 * @param {Object} pool - The database connection pool.
 * @param {Object} data - The data object to use for inserting.
 * @returns {number} - The ID of the newly inserted row.
 * @throws {Error} - If there's an error executing the insert query.
 */
async function executeInsertQuery(pool, data) {
    try {
        const result = await pool.request()
            .input('codigo_huerto', sql.TYPES.Int, data.Codigo_Huerto)
            .input('nombre_huerto', sql.TYPES.VarChar(255), data.Nombre_Huerto)
            .input('productor', sql.TYPES.VarChar(255), data.Nombre_Productor)
            .input('cajas', sql.TYPES.Decimal(10, 2), data.Cajas_proyectadas)
            .input('c_acopio', sql.TYPES.VarChar(255), data.Centro_acopio)
            .input('estado', sql.TYPES.VarChar(255), data.Estado)
            .input('has', sql.TYPES.Decimal(10, 2), data.Hectareas)
            .input('superficie', sql.TYPES.Decimal(10, 2), data.Hectareas)
            .input('codigo_pr', sql.TYPES.VarChar(255), data.PR_Productor)
            .input('fruta', sql.TYPES.VarChar(255), data.Fruta)
            .input('variedad', sql.TYPES.VarChar(255), data.Variedad)
            .input('fecha_insercion', sql.TYPES.Date, new Date(data.Fecha_Update))
            .query(env.SCRIPTS.INSERT_HUMAN_PROJECTION);

        return result.recordset[0].id; // Return the ID of the newly inserted row
    } catch (error) {
        console.error("Error executing insert query:", error);
        throw error;
    }
}

/**
 * Executes an insert query to add a new date-related row to the database.
 *
 * @param {Object} pool - The database connection pool.
 * @param {number} id - The ID of the related row.
 * @param {Object} data - The data object to use for inserting the date-related data.
 * @throws {Error} - If there's an error executing the date insert query.
 */
async function executeDateInsertQuery(pool, id, data) {
    try {
        await pool.request()
            .input('id_hpv2', sql.TYPES.Int, id)
            .input('fecha', sql.TYPES.Date, new Date(data.Semana))
            .input('cantidad', sql.TYPES.Int, parseInt(data.Cajas_proyectadas))
            .query(env.SCRIPTS.INSERT_HUMAN_PROJECTION_DATE);
    } catch (error) {
        console.error("Error executing date insert query:", error);
        throw error;
    }
}

/**
 * Insert a date-related record if it doesn't already exist.
 *
 * @param {Object} pool - The database connection pool.
 * @param {number} id - The ID of the related row.
 * @param {Object} data - The data object to use for inserting the date-related data.
 * @throws {Error} - If there's an error inserting the date record.
 */
async function insertDateRecordIfNotExists(pool, id, data) {
    try {
        const existingRecord = await checkExistingDateRecord(pool, id, data);

        if (!existingRecord) {
            await executeDateInsertQuery(pool, id, data);
        } else {
            console.log(`Date record already exists for ID ${id} and date ${data.Semana}`);
        }
    } catch (error) {
        console.error("Error inserting date record:", error);
        throw error;
    }
}

/**
 * Check if a date-related record already exists for the given ID and date.
 *
 * @param {Object} pool - The database connection pool.
 * @param {number} id - The ID of the related row.
 * @param {Object} data - The data object to use for checking the date-related data.
 * @returns {boolean} - True if the record exists, false otherwise.
 * @throws {Error} - If there's an error checking the existing date record.
 */
async function checkExistingDateRecord(pool, id, data) {
    try {
        const result = await pool.request()
            .input('id_hpv2', sql.TYPES.Int, id)
            .input('fecha', sql.TYPES.Date, new Date(data.Semana))
            .input('cantidad', sql.TYPES.Int, parseInt(data.Cajas_proyectadas))
            .query(env.SCRIPTS.VERIFY_EXIST_ROW_HUMAN_PROJECTION_DATE);

        return result.recordset.length > 0;
    } catch (error) {
        console.error("Error checking existing date record:", error);
        throw error;
    }
}

/**
 * Send an error email to the sender
 * @param {string} message - Error message to include in the email body
 * @param {boolean} isSuccess - Subject of the email
 * @param {boolean} isHtml - Whether the message body is in HTML format
 * @returns {Promise} - A promise that resolves when the email is sent
 */
async function sendReturnEmail(errorMessages, isSuccess, isHtml = true) {
    const errorMessageHTML = errorMessages.map(error => `<p class="error-message">${error}</p>`).join("");

    const html = env.HTML.HTML
        .replace('{{styles_email_complete}}', env.HTML.STYLES)
        .replace('{{fullYear}}', new Date().getFullYear())
        .replace('{{messageResult}}', errorMessageHTML);

    try {
        const ses = new AWS.SES();

        const toAddresses = [env.EMAILS.EDGAR];

        await ses.sendEmail({
            Source: env.EMAILS.AWS,
            Destination: {
                ToAddresses: toAddresses,
            },
            Message: {
                Subject: {
                    Data: isSuccess ? MESSAGES.SUCCESS.GENERATE_CSV : MESSAGES.ERROR.GENERATE_CSV,
                },
                Body: {
                    [isHtml ? 'Html' : 'Text']: {
                        Data: html,
                    },
                },
            },
        }).promise();
    } catch (error) {
        console.error(env_messages.ERROR.ERROR_SENDING_SUCCESS_EMAIL + error);
        throw new Error(env_messages.ERROR.ERROR_SENDING_SUCCESS_EMAIL + error);
    }
}


// Execute the main command
process_curve_production_before_2023();
