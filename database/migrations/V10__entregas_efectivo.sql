-- V10: Rendiciones — entregas periódicas de efectivo de agencias a gerencia.
-- Requerimiento del gerente general: registrar quién entrega, quién recibe,
-- cuánto se declaró y cuánto llegó, con confirmación en dos pasos.

CREATE TABLE IF NOT EXISTS entregas_efectivo (
    id                  BIGSERIAL PRIMARY KEY,
    agencia_id          BIGINT NOT NULL REFERENCES agencias(id),
    usuario_entrega_id  BIGINT NOT NULL REFERENCES usuarios(id),
    usuario_confirma_id BIGINT REFERENCES usuarios(id),
    numero              VARCHAR(20) NOT NULL UNIQUE,          -- REN-2026-00001
    modalidad           VARCHAR(20) NOT NULL DEFAULT 'ENTREGA_DIRECTA'
                        CHECK (modalidad IN ('ENTREGA_DIRECTA','DEPOSITO_BANCARIO')),
    nro_operacion       VARCHAR(50),                          -- voucher si es depósito
    monto_declarado     NUMERIC(10,2) NOT NULL CHECK (monto_declarado > 0),
    monto_confirmado    NUMERIC(10,2),
    diferencia          NUMERIC(10,2),
    estado              VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
                        CHECK (estado IN ('PENDIENTE','CONFIRMADA','OBSERVADA','ANULADA')),
    observaciones       TEXT,
    obs_confirmacion    TEXT,
    fecha_entrega       TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_confirmacion  TIMESTAMP,
    created_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entregas_efectivo_agencia ON entregas_efectivo(agencia_id, estado);
CREATE INDEX IF NOT EXISTS idx_entregas_efectivo_estado  ON entregas_efectivo(estado);
