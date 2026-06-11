package com.expressvraem.modules.pasajes.repository;

import com.expressvraem.modules.pasajes.entity.Pasaje;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PasajeRepository extends JpaRepository<Pasaje, Long> {

    List<Pasaje> findByViajeId(Long viajeId);

    List<Pasaje> findByClienteId(Long clienteId);

    List<Pasaje> findByAgenciaIdAndFechaEmisionBetween(Long agenciaId, LocalDateTime desde, LocalDateTime hasta);

    List<Pasaje> findByFechaEmisionBetween(LocalDateTime desde, LocalDateTime hasta);

    List<Pasaje> findByAgenciaIdOrderByFechaVentaDesc(Long agenciaId);

    List<Pasaje> findByAgenciaIdAndEstado(Long agenciaId, String estado);

    Optional<Pasaje> findOneByCodigoBoleta(String codigoBoleta);

    @Query("SELECT p FROM Pasaje p WHERE p.codigoBoleta LIKE %:q% ORDER BY p.fechaVenta DESC")
    List<Pasaje> searchByCodigoBoleta(@org.springframework.data.repository.query.Param("q") String q);

    @Query("SELECT p FROM Pasaje p WHERE p.viajeId = :viajeId AND p.estado != 'ANULADO'")
    List<Pasaje> findActivosByViajeId(Long viajeId);

    long countByViajeIdAndEstadoNot(Long viajeId, String estado);

    @Query("SELECT p FROM Pasaje p WHERE p.agenciaId = :agenciaId AND p.clienteId IN :clienteIds ORDER BY p.fechaVenta DESC")
    List<Pasaje> findByAgenciaIdAndClienteIdIn(
            @org.springframework.data.repository.query.Param("agenciaId") Long agenciaId,
            @org.springframework.data.repository.query.Param("clienteIds") java.util.Collection<Long> clienteIds);

    @Query("SELECT p FROM Pasaje p WHERE p.clienteId IN :clienteIds ORDER BY p.fechaVenta DESC")
    List<Pasaje> findByClienteIdIn(
            @org.springframework.data.repository.query.Param("clienteIds") java.util.Collection<Long> clienteIds);

    @Query("SELECT COALESCE(MAX(CAST(p.correlativo AS long)), 0) FROM Pasaje p WHERE p.agenciaId = :agenciaId AND YEAR(p.fechaVenta) = :anio")
    long maxCorrelativoByAgenciaAndAnio(
            @org.springframework.data.repository.query.Param("agenciaId") Long agenciaId,
            @org.springframework.data.repository.query.Param("anio") int anio);
}
