package com.expressvraem.modules.caja.repository;

import com.expressvraem.modules.caja.entity.Caja;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CajaRepository extends JpaRepository<Caja, Long> {
    Optional<Caja> findByUsuarioIdAndEstado(Long usuarioId, String estado);
    boolean existsByUsuarioIdAndEstado(Long usuarioId, String estado);
    List<Caja> findByAgenciaIdAndEstado(Long agenciaId, String estado);
}
