'use strict';
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');


/**
 * Serverless function to process a CSV file named 'before2023.csv' and transform its contents into an array.
 *
 * @param {object} event - The event object triggering the function.
 * @returns {object} - The response object containing the transformed data and event input.
 */
module.exports.process_curve_production_before_2023 = async (event) => {
    try {
        const filePath = path.join(__dirname, 'before2023.csv');
        const dataArray = await readCsvFile(filePath);

        console.log(dataArray)
    } catch (error) {
        console.log(error)
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
                dataArray.push(data);
            })
            .on('end', () => {
                resolve(dataArray);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}