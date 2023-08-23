'use strict';

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
    REGION: 'us-east-1'
};