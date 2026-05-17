package com.expressvraem.modules.encomiendas.repository;

import com.expressvraem.modules.encomiendas.entity.Encomienda;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface EncomiendaRepository extends JpaRepository<Encomienda, Long> {

    Optional<Encomienda> findByCodigoTracking(String codigoTracking);

    List<Encomienda> findByAgenciaIdOrderByFechaRegistroDesc(Long agenciaId);

    List<Encomienda> findByAgenciaIdAndEstadoOrderByFechaRegistroDesc(Long agenciaId, String estado);

    List<Encomienda> findByAgenciaIdAndEstado(Long agenciaId, String estado);

    List<Encomienda> findByEstadoOrderByFechaRegistroDesc(String estado);

    List<Encomienda> findAllByOrderByFechaRegistroDesc();

    List<Encomienda> findByRemitenteId(Long remitenteId);

    List<Encomienda> findByDestinatarioId(Long destinatarioId);

    List<Encomienda> findByViajeId(Long viajeId);

    @Query("""
        SELECT e FROM Encomienda e
        WHERE (:agenciaId IS NULL OR e.agenciaId = :agenciaId)
          AND (:estado    IS NULL OR e.estado = :estado)
          AND (:destino   IS NULL OR e.agenciaDestinoId = :destino)
          AND (:desde     IS NULL OR e.fechaRegistro >= :desde)
          AND (:hasta     IS NULL OR e.fechaRegistro <= :hasta)
          AND (:q         IS NULL OR LOWER(e.codigoTracking) LIKE LOWER(CONCAT('%', :q, '%')))
        ORDER BY e.fechaRegistro DESC
        """)
    List<Encomienda> buscarConFiltros(
            @Param("agenciaId") Long agenciaId,
            @Param("estado")    String estado,
            @Param("destino")   Long destino,
            @Param("desde")     LocalDateTime desde,
            @Param("hasta")     LocalDateTime hasta,
            @Param("q")         String q
    );
}
