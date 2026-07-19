package com.expressvraem.shared.utils;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Numeración correlativa atómica respaldada en BD (tabla secuencias, V13).
 * El UPSERT bloquea la fila (tipo, agencia, año), así dos ventas simultáneas
 * jamás obtienen el mismo número, y un rollback de la venta revierte también
 * el incremento (sin huecos ni duplicados). Reemplaza contadores en memoria.
 */
@Service
@RequiredArgsConstructor
public class SecuenciaService {

    private final EntityManager entityManager;

    /** agenciaId 0 (o null) = secuencia global del tipo. MANDATORY: se une a la
     *  transacción del llamador para que el número viva o muera con la operación. */
    @Transactional(propagation = Propagation.MANDATORY)
    public long siguiente(String tipo, Long agenciaId, int anio) {
        Object r = entityManager.createNativeQuery("""
                INSERT INTO secuencias (tipo, agencia_id, anio, ultimo)
                VALUES (:tipo, :agencia, :anio, 1)
                ON CONFLICT (tipo, agencia_id, anio)
                DO UPDATE SET ultimo = secuencias.ultimo + 1
                RETURNING ultimo""")
                .setParameter("tipo", tipo)
                .setParameter("agencia", agenciaId != null ? agenciaId : 0L)
                .setParameter("anio", anio)
                .getSingleResult();
        return ((Number) r).longValue();
    }
}
