'use strict';
//#region SCRIPTS
const verify_exist_row_human_projection = `
    SELECT
        Human_Projection_V2.id
    FROM
        dbo.Human_Projection_V2
    WHERE
        Human_Projection_V2.codigo_huerto = @Codigo_Huerto
        AND Human_Projection_V2.codigo_pr = @PR_Productor
        AND Human_Projection_V2.fruta = @Fruta
        AND Human_Projection_V2.variedad = @Variedad
        AND Human_Projection_V2.fecha_insercion = @fecha_insercion
`

const verify_exist_row_human_projection_date = `
    SELECT 
        Human_Projection_V2_Date.id
    FROM 
        IA_Projection.dbo.Human_Projection_V2_Date
    WHERE id_hpv2 = @id_hpv2
      AND fecha = @fecha
      AND cantidad = @cantidad
`

const insert_Projection_V2 = `
    INSERT INTO Human_Projection_V2 (codigo_huerto, nombre_huerto, productor, cajas, c_acopio,
        estado, has, superficie, codigo_pr, fruta, variedad, temporada_1,
        temporada_2, temporada_3, fecha_insercion) OUTPUT Inserted.id
    VALUES (@codigo_huerto, @nombre_huerto, @productor, @cajas, @c_acopio,
        @estado, @has, @superficie, @codigo_pr, @fruta, @variedad, 'NO',
        'NO', 'NO', @fecha_insercion);
`;

const insert_Projection_V2_Date = `
    INSERT INTO Human_Projection_V2_Date (id_hpv2, fecha, cantidad)
    VALUES (@id_hpv2, @fecha, @cantidad);
`;

//#endregion

//#region Styles
const emailStyles = `
    <style>
        /* Estilos generales */
        body {
            font-family: "Arial", sans-serif;
            line-height: 1.6;
            background-color: #f9f9f9;
            margin: 0;
        }

        /* Estilos para el encabezado */
        .header {
            background-color: #004080;
            color: #ffffff;
            text-align: center;
            padding: 20px;
        }

        .table-container {
            margin-bottom: 20px;
        }
    
        .logo {
            width: 50px;
            height: 50px;
            vertical-align: middle;
        }

        .title {
            font-size: 24px;
            vertical-align: middle;
            margin-left: 10px;
        }

        /* Estilos para el contenido */
        .content {
            border: 1px solid #cccccc;
            background-color: #ffffff;
            padding: 20px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            border-radius: 5px;
            margin: 20px 0;
        }

        .error-message {
            color: red;
            margin: 5px 0;
        }

        /* Estilos para el pie de página */
        .footer {
            text-align: center;
            padding: 20px;
            color: #888888;
        }

        .footer a {
            color: #004080;
            text-decoration: none;
        }

        /* Estilos para las tablas */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        th, td {
            border: 1px solid #cccccc;
            padding: 10px;
            text-align: left;
        }

        th {
            background-color: #f2f2f2;
            font-weight: bold;
        }

        .highlight {
            font-weight: bold;
            color: #004080;
        }
    </style>
`;
//#endregion

//#region HTML
const email_template_success = `
<html>
<head>
    {{styles_email_complete}}
</head>
<body>
    <div class="header">
        <img src="https://www.tiveg.com/images/tiveg-icon.svg" alt="Tiveg Icon" class="logo">
        <span class="title">Resultados de Validación de Datos por IA</span>
    </div>
    <div class="container">
        <div class="content">
            <p class="greeting">Estimado(a) <span class="highlight">Usuario</span>,</p>
            <p class="message">Nuestro sistema de inteligencia artificial ha completado la insercion de las proyecciones previo al 2023.</p>
            
            <p class="error-heading"><span class="highlight">Este es el resultado:</span></p>
            {{messageResult}}

            <p class="thanks">Le agradecemos su colaboración y confianza en nuestros servicios.</p>
            
            <div class="error-details-table">
            </div>
            <p class="thanks">Gracias por colaborar con nosotros.</p>
        </div>
    </div>
    <div class="footer">
        <p class="signature">© {{fullYear}} Tiveg. Todos los derechos reservados.</p>
        <p class="more-info">Para obtener más información, visita <a href="https://www.tiveg.com">www.tiveg.com</a></p>
    </div>
</body>
</html>
`
//#endregion


module.exports = {
    HEADERS: [
        {name: 'Temporada', required: true, process: 'none'},
        {name: 'Fruta', required: true, process: 'sanitize'},
        {name: 'Centro_acopio', required: true, process: 'sanitize'},
        {name: 'Estado', required: true, process: 'sanitize'},
        {name: 'PR_Productor', required: true, process: 'sanitize'},
        {name: 'Nombre_Productor', required: true, process: 'sanitize'},
        {name: 'Nombre_Huerto', required: true, process: 'sanitize'},
        {name: 'Codigo_Huerto', required: true, process: 'decimal'},
        {name: 'Hectareas', required: true, process: 'decimal'},
        {name: 'Cajas_proyectadas', required: true, process: 'decimal'},
        {name: 'Variedad', required: true, process: 'sanitize'},
        {name: 'Fecha_Update', required: true, process: 'transformDateFormat'},
        {name: 'Semana', required: true, process: 'week'}
    ],
    SCRIPTS: {
        VERIFY_EXIST_ROW_HUMAN_PROJECTION_DATE: verify_exist_row_human_projection_date,
        VERIFY_EXIST_ROW_HUMAN_PROJECTION: verify_exist_row_human_projection,
        INSERT_HUMAN_PROJECTION: insert_Projection_V2,
        INSERT_HUMAN_PROJECTION_DATE: insert_Projection_V2_Date
    },
    SECRET_MANAGER: {
        CONNECTION_DB_AWS: 'aws_database_credentials',
        CONNECTION_DB_FK: 'fk_database_credentials'
    },
    HTML: {
        STYLES: emailStyles,
        HTML: email_template_success,
    },
    EMAILS: {
        AWS: 'email_projection@projection-tiveg.awsapps.com',
        PEDRO: 'pedro.mayorga@tiveg.com,',
        EDGAR: 'edgar.verduzco@tiveg.com',
    },
    REGION: 'us-east-1'
};