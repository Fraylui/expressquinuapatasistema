package com.expressvraem.modules.encomiendas.repository;

import com.expressvraem.modules.encomiendas.entity.Encomienda;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EncomiendaRepository extends JpaRepository<Encomienda, Long>, JpaSpecificationExecutor<Encomienda> {

    Optional<Encomienda> findByCodigoTracking(String codigoTracking);

    List<Encomienda> findByAgenciaIdOrderByFechaRegistroDesc(Long agenciaId);

    List<Encomienda> findByAgenciaIdAndEstadoOrderByFechaRegistroDesc(Long agenciaId, String estado);

    List<Encomienda> findByAgenciaIdAndEstado(Long agenciaId, String estado);

    List<Encomienda> findByEstadoOrderByFechaRegistroDesc(String estado);

    List<Encomienda> findAllByOrderByFechaRegistroDesc();

    List<Encomienda> findByRemitenteId(Long remitenteId);

    List<Encomienda> findByDestinatarioId(Long destinatarioId);

    List<Encomienda> findByViajeId(Long viajeId);
    long countByViajeId(Long viajeId);

    @Query("""
        SELECT e FROM Encomienda e
        WHERE e.agenciaDestinoId = :agenciaDestinoId
          AND e.estado IN :estados
        ORDER BY e.fechaRegistro ASC
        """)
    List<Encomienda> findParaEntrega(
            @Param("agenciaDestinoId") Long agenciaDestinoId,
            @Param("estados") java.util.Collection<String> estados);

    @Query("""
        SELECT e FROM Encomienda e
        WHERE e.agenciaDestinoId = :agenciaDestinoId
          AND e.estado = 'ENTREGADO'
          AND e.fechaEntregaReal >= :inicio
        ORDER BY e.fechaEntregaReal DESC
        """)
    List<Encomienda> findEntregadasHoy(
            @Param("agenciaDestinoId") Long agenciaDestinoId,
            @Param("inicio") java.time.LocalDateTime inicio);

}
